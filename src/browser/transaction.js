import { tt } from '../lang.js'
import transaction from './transaction.html'
import { replace } from '../template_utils'
import BrowserComponent from './component.js'
import incomingNeighbors from '../icons/incomingNeighbors.html'
import outgoingNeighbors from '../icons/outgoingNeighbors.html'

export default class Transaction extends BrowserComponent {
  constructor (dispatcher, data, index, currency) {
    super(dispatcher, index, currency)
    this.data = data
    this.template = transaction
    this.options =
      [
        { html: incomingNeighbors, optionText: 'Incoming addresses', message: 'initTxInputsTable' },
        { html: outgoingNeighbors, optionText: 'Outgoing addresses', message: 'initTxOutputsTable' }
      ]
  }

  render (root) {
    if (root) this.root = root
    if (!this.root) throw new Error('root not defined')
    super.render()
    const flat = {
      tx_hash: this.data.tx_hash,
      timestamp: this.formatTimestampWithAgo(this.data.timestamp),
      total_input: this.formatCurrency(this.data.total_input[this.currency], this.data.keyspace),
      total_output: this.formatCurrency(this.data.total_output[this.currency], this.data.keyspace)
    }
    this.root.innerHTML = replace(tt(this.template), { ...this.data, ...flat })
    return this.root
  }

  requestData () {
    return { ...super.requestData(), id: this.data.address, type: 'address' }
  }
}
