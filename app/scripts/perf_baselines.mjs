import { performance } from 'node:perf_hooks'

function measure(label, fn) {
  const start = performance.now()
  const result = fn()
  const elapsed = performance.now() - start
  console.log(`${label}: ${elapsed.toFixed(2)}ms`)
  return result
}

const cards = measure('Generate 300 sprint cards', () =>
  Array.from({ length: 300 }, (_, index) => ({
    id: `card-${index}`,
    title: `Task ${index}`,
    status: index % 3 === 0 ? 'todo' : index % 3 === 1 ? 'in_progress' : 'done',
  })),
)

measure('Filter board columns', () => {
  const todo = cards.filter((card) => card.status === 'todo')
  const inProgress = cards.filter((card) => card.status === 'in_progress')
  const done = cards.filter((card) => card.status === 'done')
  return { todo, inProgress, done }
})

const ganttTasks = measure('Generate 200 Gantt tasks', () =>
  Array.from({ length: 200 }, (_, index) => ({
    id: `gantt-${index}`,
    startDay: index % 30,
    durationDays: (index % 7) + 1,
  })),
)

measure('Compute Gantt bar positions', () =>
  ganttTasks.map((task) => ({
    left: task.startDay * 12,
    width: task.durationDays * 12,
  })),
)

measure('Simulate 5 concurrent doc updates', () => {
  let text = ''
  for (let i = 0; i < 5; i += 1) {
    text += `Editor-${i} updated. `
  }
  return text.length
})

measure('Report aggregation with 120 deals', () => {
  const deals = Array.from({ length: 120 }, (_, index) => ({
    value: 1000 + index * 50,
    probability: index % 5 === 0 ? 0.8 : 0.3,
  }))
  return deals.reduce((sum, deal) => sum + deal.value * deal.probability, 0)
})
