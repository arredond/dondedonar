import { forwardRef } from 'react'
import dayjs from 'dayjs'

// Forwards a ref to the <nav> so App can measure its rendered width and size
// the floating list panel to match (see the ResizeObserver in App.jsx).
const DateNav = forwardRef(function DateNav(
  /** @type {Record<string, any>} */ { selectedDate, onSelectDate },
  ref
) {
  const today = dayjs()
  const days = Array.from({ length: 5 }, (_, i) => today.add(i, 'day'))

  function label(i) {
    if (i === 0) return 'Hoy'
    if (i === 1) return 'Mañana'
    const name = days[i].format('dddd')
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  const isAbiertoAhora = selectedDate === null
  const isActive = day => selectedDate && day.isSame(selectedDate, 'day')

  return (
    <nav
      ref={ref}
      className="self-start flex items-end gap-4 md:gap-6 px-4 md:px-6 max-w-full overflow-x-auto overflow-y-hidden bg-white rounded-2xl shadow-md"
    >
      <Tab
        top="Abierto"
        bottom="ahora"
        active={isAbiertoAhora}
        onClick={() => onSelectDate(null)}
      />
      {days.map((day, i) => (
        <Tab
          key={day.format('YYYY-MM-DD')}
          top={label(i)}
          bottom={day.format('D MMM').toUpperCase()}
          active={isActive(day)}
          onClick={() => onSelectDate(day)}
        />
      ))}
    </nav>
  )
})

export default DateNav

function Tab({ top, bottom, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center py-3 border-b-2 transition-colors shrink-0 ${
        active
          ? 'border-red-600 text-red-600'
          : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}
    >
      <span className="text-sm font-semibold whitespace-nowrap">{top}</span>
      <span className="text-xs mt-0.5 whitespace-nowrap">{bottom}</span>
    </button>
  )
}
