'use client'
import { depositAmount, money2 } from '@/lib/payments'

// "Deposit required" in the quote builder. Optional: off, the quote is the
// same as ever. On, the professional asks for a percentage (1 to 100,
// default 50) or a fixed Bds$ amount upfront; the figure follows the line
// items as they change. Stored on the quote as deposit_type / deposit_value.
const fieldCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white'

export default function DepositSection({ total, on, type, value, onChange }) {
  const amount = on ? depositAmount(total, type, value) : 0
  const balance = Math.max(0, Math.round((Number(total) - amount) * 100) / 100)
  const tooBig = on && type === 'fixed' && Number(value) > Number(total) && Number(total) > 0
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          id="quote-deposit"
          checked={on}
          onChange={e => onChange({ on: e.target.checked, type: type || 'percent', value: value === '' || value == null ? (type === 'fixed' ? '' : 50) : value })}
          className="mt-0.5 w-4 h-4 flex-shrink-0"
        />
        <span>
          <span className="block text-sm font-semibold text-gray-900">Require a deposit</span>
          <span className="block text-xs text-gray-500 mt-0.5">The client pays this upfront. The balance is due on completion.</span>
        </span>
      </label>

      {on && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex gap-2" role="group" aria-label="Deposit type">
            {[['percent', 'Percentage'], ['fixed', 'Fixed amount']].map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ on, type: v, value: v === 'percent' ? 50 : '' })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${type === v ? '' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}
                style={type === v ? { backgroundColor: '#F9C000', color: '#00267F' } : {}}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label htmlFor="quote-deposit-value" className="block text-xs font-semibold text-gray-700 mb-1">{type === 'fixed' ? 'Amount (Bds$)' : 'Percentage (%)'}</label>
              <input
                id="quote-deposit-value"
                type="number"
                inputMode="decimal"
                min={type === 'fixed' ? '0.01' : '1'}
                max={type === 'fixed' ? undefined : '100'}
                step={type === 'fixed' ? '0.01' : '1'}
                value={value}
                onChange={e => onChange({ on, type, value: e.target.value })}
                className={fieldCls}
              />
            </div>
            <div className="text-xs text-gray-600 pb-2 tabular-nums">
              Deposit <span className="font-bold" style={{ color: '#00267F' }}>Bds${money2(amount)}</span><br />
              Balance Bds${money2(balance)}
            </div>
          </div>
          {tooBig && <p className="text-xs" style={{ color: '#B45309' }}>The deposit is more than the total, so it is capped at the total.</p>}
        </div>
      )}
    </div>
  )
}

/** The columns to save on the quote: empty when off or not a valid deposit. */
export function depositColumns(on, type, value) {
  const v = Number(value)
  if (!on || !['percent', 'fixed'].includes(type) || !(v > 0)) return {}
  if (type === 'percent' && v > 100) return { deposit_type: 'percent', deposit_value: 100 }
  return { deposit_type: type, deposit_value: Math.round(v * 100) / 100 }
}
