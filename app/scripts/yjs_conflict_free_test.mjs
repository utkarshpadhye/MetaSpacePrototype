import * as Y from 'yjs'

const docA = new Y.Doc()
const docB = new Y.Doc()

const textA = docA.getText('tiptap')
const textB = docB.getText('tiptap')

textA.insert(0, 'Hello ')
textB.insert(0, 'World ')

const updateA = Y.encodeStateAsUpdate(docA)
const updateB = Y.encodeStateAsUpdate(docB)

Y.applyUpdate(docA, updateB)
Y.applyUpdate(docB, updateA)

const mergedA = textA.toString()
const mergedB = textB.toString()

const ok = mergedA.includes('Hello') && mergedA.includes('World') && mergedA === mergedB

if (!ok) {
  console.error('Conflict-free merge failed', { mergedA, mergedB })
  process.exit(1)
}

console.log('Yjs merge OK:', mergedA)
