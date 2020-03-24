import menuLayout from './config/menu.html'
import notes from './config/notes.html'
import tagpack from './config/tagpack.html'
import Component from './component.js'
import Logger from './logger.js'
import searchDialog from './config/searchDialog.html'
import categoryForm from './config/categoryForm.html'
import addressesForm from './config/addressesForm.html'
import { maxSearchBreadth, maxSearchDepth } from './globals.js'
import { replace, addClass, removeClass } from './template_utils.js'
import Search from './search/search.js'

const logger = Logger.create('Menu') // eslint-disable-line

const defaultCriterion = 'category'
const defaultParams = () => ({ category: null, addresses: [] })
const defaultDepth = 2
const defaultBreadth = 20

export default class Menu extends Component {
  constructor (dispatcher) {
    super()
    this.dispatcher = dispatcher
    this.view = {}
    this.categories = []
  }

  showNodeDialog (x, y, params) {
    let menuWidth = 250
    let menuHeight = 300
    if (params.dialog === 'note') {
      this.view = { viewType: 'note', data: params.data }
    } else if (params.dialog === 'tagpack') {
      const labels = params.data.tags
        .filter(tag => tag.isUserDefined)
        .reduce((labels, tag) => {
          labels[tag.label] = { ...tag }
          return labels
        }, {})
      this.view = { viewType: 'tagpack', data: params.data, labels }
    } else if (params.dialog === 'search') {
      this.view = {
        viewType: 'search',
        id: params.id,
        type: params.type,
        isOutgoing: params.isOutgoing,
        criterion: defaultCriterion,
        params: defaultParams(),
        depth: defaultDepth,
        breadth: defaultBreadth,
        skipNumAddresses: defaultBreadth
      }
      menuWidth = 400
      menuHeight = 400
    }
    this.setMenuPosition(x, y, menuWidth, menuHeight)
    this.setUpdate(true)
  }

  setMenuPosition (x, y, menuWidth, menuHeight) {
    const w = window
    const d = document
    const e = d.documentElement
    const g = d.getElementsByTagName('body')[0]
    const width = w.innerWidth || e.clientWidth || g.clientWidth
    const height = w.innerHeight || e.clientHeight || g.clientHeight
    if (x + menuWidth > width) x -= menuWidth
    if (y + menuHeight > height) y -= menuWidth
    this.menuX = x
    this.menuY = y
  }

  getType () {
    return this.view.viewType
  }

  setCategories (categories) {
    this.categories = categories
  }

  hideMenu () {
    this.view = {}
    this.setUpdate(true)
  }

  render (root) {
    if (root) this.root = root
    if (!this.root) throw new Error('root not defined')
    if (!this.shouldUpdate()) {
      if (this.search) this.search.render()
      return this.root
    }
    if (this.shouldUpdate(true)) {
      if (!this.view.viewType) {
        this.root.innerHTML = ''
        super.render()
        return
      }
      this.root.innerHTML = menuLayout
      const menu = this.root.querySelector('#menu-frame')
      menu.addEventListener('click', (e) => {
        this.dispatcher('hideContextmenu')
      })
      menu.addEventListener('contextmenu', (e) => {
        e.stopPropagation()
        e.preventDefault()
        return false
      })
      const box = this.root.querySelector('#menu-box')
      box.style.left = this.menuX + 'px'
      box.style.top = this.menuY + 'px'
      box.addEventListener('click', (e) => {
        e.stopPropagation()
      })
      const el = this.root.querySelector('#config')
      let title
      if (this.view.viewType === 'note') {
        title = 'Notes'
        el.innerHTML = notes
        this.setupNotes(el)
      } else if (this.view.viewType === 'tagpack') {
        title = 'Add tags'
        el.innerHTML = tagpack
        this.setupTagpack(el)
      } else if (this.view.viewType === 'search') {
        const dir = this.view.isOutgoing ? 'outgoing' : 'incoming'
        title = `Search ${dir} neighbors`
        el.innerHTML = replace(searchDialog,
          {
            searchDepth: this.view.depth,
            searchBreadth: this.view.breadth,
            maxSearchBreadth: maxSearchBreadth,
            maxSearchDepth: maxSearchDepth,
            skipNumAddresses: this.view.skipNumAddresses
          }
        )
        this.setupSearch(el)
      }
      this.root.querySelector('.title').innerHTML = title
    } else if (this.shouldUpdate('skipNumAddresses')) {
      const el = this.root.querySelector('#skipNumAddresses')
      el.value = this.view.skipNumAddresses
      el.setAttribute('min', this.view.breadth)
    }
    super.render()
    return this.root
  }

  renderInput (id, message, value) {
    const input = this.root.querySelector('input#' + id)
    input.value = value
    input.addEventListener('input', (e) => {
      this.dispatcher(message, e.target.value)
    })
  }

  setupNotes (el) {
    const data = this.view.data
    const input = el.querySelector('textarea')
    input.value = data.notes || ''
    input.addEventListener('input', (e) => {
      this.dispatcher('inputNotes', { id: data.id, type: data.type, keyspace: data.keyspace, note: e.target.value })
    })
  }

  setupTagpack (el) {
    const searchinput = el.querySelector('.searchinput')
    this.search = new Search(this.dispatcher, ['labels'], this.view.viewType)
    this.search.render(searchinput)
    const searchLabels = el.querySelector('.searchlabels')
    for (const label in this.view.labels) {
      removeClass(searchLabels, 'invisible')
      const tr = document.createElement('tr')
      let td = document.createElement('td')
      const span = document.createElement('span')
      span.innerHTML = '<i class="fas fa-times-circle fa-lg pr-2"></i>'
      span.addEventListener('click', () => {
        this.dispatcher('removeLabel', label)
      })
      td.appendChild(span)
      tr.appendChild(td)
      td = document.createElement('td')
      const l = document.createTextNode(label)
      td.appendChild(l)
      tr.appendChild(td)
      td = document.createElement('td')
      td.innerHTML = '<select name="category" class="m-2"><option value=""></option></select>'
      this.categories.forEach(category => {
        const option = document.createElement('option')
        option.innerHTML = category
        option.setAttribute('value', category)
        if (category === this.view.labels[label].category) {
          option.setAttribute('selected', 'selected')
        }
        td.firstChild.appendChild(option)
      })
      td.firstChild.addEventListener('change', (e) => {
        this.dispatcher('changeTagpackCategory', { category: e.target.value, label })
      })
      tr.appendChild(td)
      searchLabels.appendChild(tr)
    }
    const button = el.querySelector('input[type="button"]')
    button.addEventListener('click', () => {
      this.dispatcher('setLabels', {
        id: this.view.data.id,
        type: this.view.data.type,
        keyspace: this.view.data.keyspace,
        labels: this.view.labels
      })
    })
  }

  setupSearch (el) {
    el.querySelector('.criterion').addEventListener('change', e => {
      this.dispatcher('changeSearchCriterion', e.target.value)
    })
    this.renderInput('searchDepth', 'changeSearchDepth', this.view.depth)
    this.renderInput('searchBreadth', 'changeSearchBreadth', this.view.breadth)
    this.renderInput('skipNumAddresses', 'changeSkipNumAddresses', this.view.skipNumAddresses)
    const form = el.querySelector('.searchValue')
    if (this.view.criterion === 'category') {
      form.innerHTML = categoryForm
      const input = form.querySelector('select')
      this.categories.forEach(category => {
        const option = document.createElement('option')
        option.innerHTML = category
        option.setAttribute('value', category)
        if (category === this.view.params.category) {
          option.setAttribute('selected', 'selected')
        }
        input.appendChild(option)
      })
      input.addEventListener('change', (e) => {
        this.dispatcher('changeSearchCategory', e.target.value)
      })
      el.querySelector('input[value="category"]').setAttribute('checked', 'checked')
      el.querySelector('input[value="addresses"]').removeAttribute('checked')
    } else if (this.view.criterion === 'addresses') {
      form.innerHTML = addressesForm
      const searchinput = form.querySelector('.searchinput')
      this.search = new Search(this.dispatcher, ['addresses'], this.view.viewType)
      this.search.setKeyspaces([this.view.id[2]])
      this.search.render(searchinput)
      const searchAddresses = form.querySelector('.searchaddresses')
      this.view.params.addresses.forEach(address => {
        const li = document.createElement('li')
        li.innerHTML = address
        searchAddresses.appendChild(li)
      })
      el.querySelector('input[value="addresses"]').setAttribute('checked', 'checked')
      el.querySelector('input[value="category"]').removeAttribute('checked')
    }
    const button = el.querySelector('input[type="button"]')
    if (this.view.params.category || this.view.params.addresses.length > 0) {
      button.addEventListener('click', () => {
        this.dispatcher('searchNeighbors', {
          id: this.view.id,
          type: this.view.type,
          isOutgoing: this.view.isOutgoing,
          depth: this.view.depth,
          breadth: this.view.breadth,
          skipNumAddresses: this.view.skipNumAddresses,
          params: this.view.params
        })
      })
    } else {
      addClass(button, 'disabled')
    }
  }

  setSearchCriterion (criterion) {
    if (this.view.viewType !== 'search') return
    this.view.criterion = criterion
    this.view.params = defaultParams()
    this.setUpdate(true)
  }

  setSearchCategory (category) {
    if (this.view.viewType === 'search' && this.view.criterion !== 'category') {
      this.view.params.category = category
      this.setUpdate(true)
    } else if (this.view.viewType === 'tagpack') {
      this.view.category = category
      this.setUpdate(true)
    }
  }

  setSearchDepth (d) {
    if (this.view.viewType !== 'search') return
    this.view.depth = Math.min(d, maxSearchDepth)
    if (d > maxSearchDepth) {
      this.setUpdate(true)
    }
  }

  setSearchBreadth (d) {
    if (this.view.viewType !== 'search') return
    this.view.breadth = Math.min(d, maxSearchBreadth)
    this.view.skipNumAddresses = Math.max(this.view.breadth, this.view.skipNumAddresses)
    if (d > maxSearchBreadth) {
      this.setUpdate(true)
    }
    this.setUpdate('skipNumAddresses')
  }

  setSkipNumAddresses (d) {
    if (this.view.viewType !== 'search') return
    this.view.skipNumAddresses = Math.max(d, this.view.breadth || maxSearchBreadth)
    if (d < this.view.skipNumAddresses) {
      this.setUpdate(true)
    }
  }

  addSearchAddress (address) {
    if (this.view.viewType !== 'search' || this.view.criterion !== 'addresses') return
    this.view.params.addresses.push(address)
    this.setUpdate(true)
  }

  addSearchLabel (label) {
    if (this.view.viewType !== 'tagpack') return
    if (this.view.labels[label]) return
    this.view.labels[label] = { label, category: null }
    this.setUpdate(true)
  }

  removeSearchLabel (label) {
    logger.debug('removelabel', label)
    if (this.view.viewType !== 'tagpack') return
    delete this.view.labels[label]
    logger.debug('labels', this.view.labels)
    this.setUpdate(true)
  }

  setTagpackCategory (label, category) {
    if (this.view.viewType !== 'tagpack') return
    if (!this.view.labels[label]) return
    this.view.labels[label].category = category
    logger.debug('setTagpackCategory', JSON.stringify(this.view.labels))
    this.setUpdate(true)
  }
}
