import search from './search.html'
import Component from '../component.js'
import {replace, addClass, removeClass} from '../template_utils.js'
import Logger from '../logger.js'
import {firstToUpper} from '../utils.js'

const logger = Logger.create('Search') // eslint-disable-line no-unused-vars

const empty = {addresses: [], transactions: [], tags: []}
const numShowResults = 7

const byPrefix = term => addr => addr.startsWith(term)

export default class Search extends Component {
  constructor (dispatcher, keyspaces, types, isInDialog = false) {
    super()
    this.keyspaces = keyspaces
    this.types = types || Object.keys(empty).concat(['blocks'])
    this.dispatcher = dispatcher
    this.term = ''
    this.resultTerm = ''
    this.isInDialog = isInDialog
    this.clearResults()
    this.timeout = {}
    for (let key in keyspaces) {
      this.timeout[key] = null
    }
  }
  setStats (stats) {
    this.stats = stats
  }
  clearResults () {
    this.result = {}
    for (let keyspace in this.keyspaces) {
      this.result[keyspace] = {...empty}
    }
  }
  clear () {
    this.clearResults()
    this.term = ''
    this.isLoading = false
    this.setUpdate(true)
  }
  error (keyspace, msg) {
    this.result[keyspace].error = msg
    this.setUpdate('result')
  }
  showLoading () {
    if (!this.isLoading) {
      this.isLoading = true
      this.setUpdate('result')
    }
  }
  hideLoading () {
    if (this.isLoading) {
      this.isLoading = false
      this.setUpdate('result')
    }
  }
  renderLoading () {
    if (this.isLoading) {
      // removeClass(this.root.querySelector('#browser-search-result'), 'hidden')
      this.root.querySelector('#indicator').style.display = 'inline'
    } else {
      // addClass(this.root.querySelector('#browser-search-result'), 'hidden')
      this.root.querySelector('#indicator').style.display = 'none'
    }
  }
  typesToPlaceholder () {
    return firstToUpper(this.types.map(type => {
      switch (type) {
        case 'addresses' : return 'addresses'
        case 'transactions' : return 'transaction'
        case 'blocks' : return 'block'
        case 'tags' : return 'tag'
      }
    }).join(', '))
  }
  render (root) {
    if (root) this.root = root
    if (!this.root) throw new Error('root not defined')
    if (!this.shouldUpdate()) return
    if (this.shouldUpdate(true)) {
      super.render()
      let placeholder = this.typesToPlaceholder()
      logger.debug('placeholder', placeholder)
      this.root.innerHTML = replace(search, {placeholder})
      this.input = this.root.querySelector('textarea')
      this.renderTerm()
      this.form = this.root.querySelector('form')
      this.form.addEventListener('submit', (e) => {
        e.returnValue = false
        e.preventDefault()
        for (let keyspace in this.result) {
          if (this.types.indexOf('addresses') !== -1 && this.result[keyspace].addresses.length > 0) {
            let addresses = this.result[keyspace].addresses.filter(byPrefix(this.term))
            this.dispatcher('clickSearchResult', {id: addresses[0], type: 'address', keyspace, isInDialog: this.isInDialog})
            return false
          }
          if (this.types.indexOf('transactions') !== -1 && this.result[keyspace].transactions.length > 0) {
            let transactions = this.result[keyspace].transactions.filter(byPrefix(this.term))
            this.dispatcher('clickSearchResult', {id: transactions[0], type: 'transaction', keyspace, isInDialog: this.isInDialog})
            return false
          }
          if (this.types.indexOf('tags') !== -1 && this.result[keyspace].tags.length > 0) {
            let tags = this.result[keyspace].tags.filter(byPrefix(this.term))
            this.dispatcher('clickSearchResult', {id: tags[0], type: 'tag', keyspace, isInDialog: this.isInDialog})
            return false
          }
          let blocks = this.blocklist(3, keyspace, this.term)
          if (this.types.indexOf('blocks') !== -1 && blocks.length > 0) {
            this.dispatcher('clickSearchResult', {id: blocks[0], type: 'block', keyspace, isInDialog: this.isInDialog})
            return false
          }
        }
        this.term.split('\n').forEach((address) => {
          for (let keyspace in this.keyspaces) {
            this.dispatcher('clickSearchResult', {id: address, type: 'address', keyspace, isInDialog: this.isInDialog})
          }
        })
        return false
      })
      this.input.addEventListener('keypress', (e) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        this.form.querySelector('button[type=\'submit\']').click()
      })
      this.input.addEventListener('input', (e) => {
        this.dispatcher('search', {
          term: e.target.value,
          types: this.types,
          keyspaces: this.keyspaces,
          isInDialog: this.isInDialog
        })
      })
      this.input.addEventListener('blur', () => {
      // wrap in timeout to let possible clicksearchresult event happen
        setTimeout(() => this.dispatcher('blurSearch'), 200)
      })
      this.renderResult()
      return this.root
    }
    if (this.shouldUpdate('result')) {
      this.renderResult()
    }
    if (this.shouldUpdate('term')) {
      this.renderTerm()
    }
    super.render()
    return this.root
  }
  renderTerm () {
    if (!this.input) return
    this.input.value = this.term
    let lines = this.term.split('\n')
    if (lines.length === 1) {
      this.input.style.height = '100%'
      return
    }
    this.input.style.height = (lines.length + 1) * 1.13 + 'em'
  }
  setSearchTerm (term, prefixLength) {
    this.term = term.split('\n').filter(line => line).join('\n')
    this.setUpdate('result')
    this.setUpdate('term')
    if (this.term.length < prefixLength) {
      this.clearResults()
    }
  }
  isMultiline () {
    return this.term.indexOf('\n') !== -1
  }
  needsResults (keyspace, limit, prefixLength) {
    if (this.isMultiline()) return false
    if (this.term.length < prefixLength) return false
    let alen = this.result[keyspace].addresses.length
    let tlen = this.result[keyspace].transactions.length
    let talen = this.result[keyspace].tags.length
    return !(((alen !== 0 && alen < limit) || (tlen !== 0 && tlen < limit) || (talen !== 0 && talen < limit)) && this.term.startsWith(this.resultTerm))
  }
  renderOptions () {
    return null
  }

  renderResult () {
    let frame = this.root.querySelector('#browser-search-result')
    let el = frame.querySelector('#result')
    el.innerHTML = ''

    let visible = this.isLoading
    let allErrors = true
    for (let keyspace in this.keyspaces) {
      let addresses = this.result[keyspace].addresses
        .filter(byPrefix(this.term))
        .slice(0, numShowResults)

      let transactions = this.result[keyspace].transactions
        .filter(byPrefix(this.term))
        .slice(0, numShowResults)

      let tags = this.result[keyspace].tags
        .filter(byPrefix(this.term))
        .slice(0, numShowResults)

      let blocks = this.blocklist(3, keyspace, this.term)

      let keyspaceVisible =
        this.result[keyspace].error ||
        addresses.length > 0 ||
        transactions.length > 0 ||
        tags.length > 0 ||
        blocks.length > 0
      visible = visible || keyspaceVisible
      if (this.result[keyspace].error) {
        continue
      }
      // if no results to render don't draw the title and the list at all
      if (!keyspaceVisible) continue

      allErrors = false

      let ul = document.createElement('ol')
      ul.className = 'list-reset'
      let searchLine = (type, icon) => (id) => {
        let li = document.createElement('li')
        li.className = 'cursor-pointer'
        li.innerHTML = `<i class="fas fa-${icon} pr-1 text-grey text-sm"></i>${id}`
        li.addEventListener('click', () => {
          this.dispatcher('clickSearchResult', {id, type, keyspace, isInDialog: this.isInDialog})
        })
        ul.appendChild(li)
      }
      addresses.forEach(searchLine('address', 'at'))
      transactions.forEach(searchLine('transaction', 'exchange-alt'))
      tags.forEach(searchLine('tag', 'tag'))
      blocks.forEach(searchLine('block', 'cube'))
      let title = document.createElement('div')
      title.className = 'font-bold py-1'
      title.appendChild(document.createTextNode(this.keyspaces[keyspace]))
      el.appendChild(title)
      el.appendChild(ul)
    }
    if (allErrors) {
      el.innerHTML = `Failed to fetch from any keyspaces`
      addClass(el, 'text-gs-red')
    } else {
      removeClass(el, 'text-gs-red')
    }
    if (visible) {
      addClass(frame, 'block')
      removeClass(frame, 'hidden')
    } else {
      removeClass(frame, 'block')
      addClass(frame, 'hidden')
    }
    this.renderLoading()
  }
  setResult (term, result) {
    if (term !== this.term) return
    this.result[result.keyspace] = {
      addresses: result.addresses || [],
      transactions: result.transactions || [],
      tags: result.tags || []
    }
    this.resultTerm = term
    this.setUpdate('result')
  }
  blocklist (limit, keyspace, prefix) {
    if (!this.stats || !this.stats[keyspace]) return []
    prefix = prefix * 1
    if (typeof prefix !== 'number') return []
    if (prefix <= 0) return []
    if (prefix < this.stats[keyspace].no_blocks) {
      return [prefix]
    }
    return []
  }
}
