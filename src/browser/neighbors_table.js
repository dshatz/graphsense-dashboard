import Table from './table.js'

export default class NeighborsTable extends Table {
  constructor (dispatcher, index, total, id, type, isOutgoing, currency, keyspace) {
    super(dispatcher, index, total, currency, keyspace)
    this.isOutgoing = isOutgoing
    this.columns = [
      { name: (isOutgoing ? 'Outgoing ' : 'Incoming ') + type,
        data: 'id'
      },
      { name: 'Balance',
        data: 'balance',
        className: 'text-right',
        render: (value, type) =>
          this.formatValue(value => this.formatCurrency(value, keyspace, true))(value[this.currency], type)
      },
      { name: 'Received',
        data: 'received',
        className: 'text-right',
        render: (value, type) =>
          this.formatValue(value => this.formatCurrency(value, keyspace, true))(value[this.currency], type)
      },
      { name: 'No. Tx',
        data: 'noTransactions'
      }
    ]
    this.loadMessage = 'loadNeighbors'
    this.resultField = 'neighbors'
    this.selectMessage = 'selectNeighbor'
    this.loadParams = [id, type, isOutgoing]
  }
  smallThreshold () {
    return 2000
  }
}
