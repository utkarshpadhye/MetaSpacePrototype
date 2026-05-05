import { useEffect, useMemo, useState } from 'react'

type LibraryTab = 'courses' | 'books' | 'news' | 'company'
type UserRole = 'public' | 'employee' | 'admin'

type CourseLink = {
  title: string
  provider: string
  url: string
}

type Book = {
  id: string
  title: string
  author: string
  category: string
  year: number
  language: string
  pdfPath: string
}

type NewsItem = {
  id: string
  title: string
  source: string
  kind: 'newspaper' | 'magazine'
  publishedAt: string
  url: string
}

type CompanyDoc = {
  id: string
  title: string
  type: 'policy' | 'revenue' | 'audit' | 'archive' | 'bulletin'
  dateLabel: string
  summary: string
  url?: string
}

const TAB_META: Array<{ id: LibraryTab; label: string }> = [
  { id: 'courses', label: 'E-Courses' },
  { id: 'books', label: 'Books' },
  { id: 'news', label: 'Newspaper & Magazine' },
  { id: 'company', label: 'Company Documents' },
]

const COURSE_LINKS: Record<string, CourseLink[]> = {
  'AI/ML': [
    {
      title: 'Machine Learning Specialization',
      provider: 'Coursera',
      url: 'https://www.coursera.org/specializations/machine-learning-introduction',
    },
    {
      title: 'Practical Deep Learning for Coders',
      provider: 'fast.ai',
      url: 'https://course.fast.ai/',
    },
  ],
  'Cloud/DevOps': [
    {
      title: 'AWS Skill Builder Learning Plans',
      provider: 'AWS',
      url: 'https://skillbuilder.aws/learning-plans',
    },
    {
      title: 'Docker Curriculum',
      provider: 'Docker',
      url: 'https://docker-curriculum.com/',
    },
  ],
  Databases: [
    {
      title: 'SQL Tutorial',
      provider: 'SQLBolt',
      url: 'https://sqlbolt.com/',
    },
    {
      title: 'Database Systems Concepts',
      provider: 'CMU Open Learning',
      url: 'https://15445.courses.cs.cmu.edu/fall2023/',
    },
  ],
  DSA: [
    {
      title: 'Algorithms, Part I',
      provider: 'Princeton / Coursera',
      url: 'https://www.coursera.org/learn/algorithms-part1',
    },
    {
      title: 'NeetCode Roadmap',
      provider: 'NeetCode',
      url: 'https://neetcode.io/roadmap',
    },
  ],
  Networking: [
    {
      title: 'Computer Networking',
      provider: 'Stanford Lagunita archive',
      url: 'https://lagunita.stanford.edu/courses/Engineering/Networking-SP/SelfPaced/about',
    },
    {
      title: 'The Bits and Bytes of Computer Networking',
      provider: 'Coursera',
      url: 'https://www.coursera.org/learn/computer-networking',
    },
  ],
  'Programming Languages': [
    {
      title: 'The Odin Project',
      provider: 'The Odin Project',
      url: 'https://www.theodinproject.com/',
    },
    {
      title: 'CS50x',
      provider: 'Harvard / edX',
      url: 'https://cs50.harvard.edu/x/',
    },
  ],
  'System Design': [
    {
      title: 'System Design Primer',
      provider: 'GitHub',
      url: 'https://github.com/donnemartin/system-design-primer',
    },
    {
      title: 'Grokking Modern System Design',
      provider: 'Educative',
      url: 'https://www.educative.io/courses/grokking-modern-system-design-interview-for-engineers-managers',
    },
  ],
}

const BOOKS: Book[] = [
  {
    id: 'book-1',
    title: 'Clean Code Quick Notes',
    author: 'MetaSpace Learning Team',
    category: 'Programming Languages',
    year: 2025,
    language: 'English',
    pdfPath: '/assets/library/books/clean-code-notes.pdf',
  },
  {
    id: 'book-2',
    title: 'DSA Patterns Handbook',
    author: 'MetaSpace Learning Team',
    category: 'DSA',
    year: 2025,
    language: 'English',
    pdfPath: '/assets/library/books/dsa-patterns-handbook.pdf',
  },
  {
    id: 'book-3',
    title: 'Computer Networking Basics',
    author: 'MetaSpace Learning Team',
    category: 'Networking',
    year: 2024,
    language: 'English',
    pdfPath: '/assets/library/books/networking-basics.pdf',
  },
]

const NEWS_ITEMS: NewsItem[] = [
  {
    id: 'news-1',
    title: 'The Hacker News Front Page',
    source: 'Hacker News',
    kind: 'newspaper',
    publishedAt: 'Live',
    url: 'https://news.ycombinator.com/',
  },
  {
    id: 'news-2',
    title: 'MIT Technology Review',
    source: 'MIT',
    kind: 'magazine',
    publishedAt: 'Latest Issue',
    url: 'https://www.technologyreview.com/',
  },
  {
    id: 'news-3',
    title: 'InfoQ Engineering News',
    source: 'InfoQ',
    kind: 'newspaper',
    publishedAt: 'Daily',
    url: 'https://www.infoq.com/news/',
  },
  {
    id: 'news-4',
    title: 'Wired Tech',
    source: 'Wired',
    kind: 'magazine',
    publishedAt: 'Latest',
    url: 'https://www.wired.com/category/business/',
  },
]

const COMPANY_DOCS: CompanyDoc[] = [
  {
    id: 'doc-1',
    title: 'Employee Policy Handbook',
    type: 'policy',
    dateLabel: 'Updated Jan 2026',
    summary: 'Leave policy, code of conduct, and workplace standards.',
    url: '/assets/library/company/policy-handbook.pdf',
  },
  {
    id: 'doc-2',
    title: 'Quarterly Revenue Snapshot',
    type: 'revenue',
    dateLabel: 'Q1 FY2026',
    summary: 'Topline revenue, margin trends, and department highlights.',
    url: '/assets/library/company/revenue-q1-fy2026.pdf',
  },
  {
    id: 'doc-3',
    title: 'Internal Audit Checklist',
    type: 'audit',
    dateLabel: 'Mar 2026',
    summary: 'Security controls and process audit completion summary.',
  },
  {
    id: 'doc-4',
    title: 'Archive: FY2024 Annual Summary',
    type: 'archive',
    dateLabel: 'FY2024',
    summary: 'Historical annual summary with milestones and outcomes.',
    url: '/assets/library/company/archive-fy2024-summary.pdf',
  },
  {
    id: 'doc-5',
    title: 'Bulletin: Office Infra Upgrade',
    type: 'bulletin',
    dateLabel: '20 Apr 2026',
    summary: 'Weekend maintenance notice for conferencing hardware refresh.',
  },
]

function getStoredRole(): UserRole {
  const role = window.localStorage.getItem('metaspace-user-role')
  if (role === 'employee' || role === 'admin' || role === 'public') {
    return role
  }
  return 'employee'
}

export function LibraryPortal() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('courses')
  const [role, setRole] = useState<UserRole>(() => getStoredRole())
  const [bookSearch, setBookSearch] = useState('')
  const [bookCategory, setBookCategory] = useState('all')
  const [bookAuthor, setBookAuthor] = useState('all')
  const [lastNewsRefreshAt, setLastNewsRefreshAt] = useState(() => Date.now())

  useEffect(() => {
    window.localStorage.setItem('metaspace-user-role', role)
  }, [role])

  const sortedCourseCategories = useMemo(
    () => Object.keys(COURSE_LINKS).sort((a, b) => a.localeCompare(b)),
    [],
  )

  const bookCategories = useMemo(() => {
    return ['all', ...Array.from(new Set(BOOKS.map((book) => book.category))).sort()]
  }, [])

  const bookAuthors = useMemo(() => {
    return ['all', ...Array.from(new Set(BOOKS.map((book) => book.author))).sort()]
  }, [])

  const filteredBooks = useMemo(() => {
    const query = bookSearch.trim().toLowerCase()

    return BOOKS.filter((book) => {
      const categoryOk = bookCategory === 'all' || book.category === bookCategory
      const authorOk = bookAuthor === 'all' || book.author === bookAuthor
      const textOk =
        query.length === 0 ||
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query)
      return categoryOk && authorOk && textOk
    })
  }, [bookAuthor, bookCategory, bookSearch])

  const groupedCompanyDocs = useMemo(() => {
    return {
      policy: COMPANY_DOCS.filter((doc) => doc.type === 'policy'),
      revenue: COMPANY_DOCS.filter((doc) => doc.type === 'revenue'),
      audit: COMPANY_DOCS.filter((doc) => doc.type === 'audit'),
      archive: COMPANY_DOCS.filter((doc) => doc.type === 'archive'),
      bulletin: COMPANY_DOCS.filter((doc) => doc.type === 'bulletin'),
    }
  }, [])

  const tabButtonClass = (isActive: boolean) =>
    `pixel-button rounded px-2 py-1 text-[9px] ${
      isActive ? 'bg-[#d9e9ff] text-[var(--pixel-accent)]' : 'text-[var(--pixel-ink)]'
    }`

  return (
    <div className="pixel-ui flex h-full min-h-0 flex-col gap-3 overflow-hidden text-[var(--pixel-ink)]">
      <div className="pixel-panel flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2">
        <div className="flex flex-wrap gap-2">
          {TAB_META.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={tabButtonClass(activeTab === tab.id)}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[10px] text-[var(--pixel-ink)]">
          Access
          <select
            className="pixel-input rounded px-2 py-1 text-[10px]"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            <option value="public">Public</option>
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      {activeTab === 'courses' ? (
        <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2">
          {sortedCourseCategories.map((category) => {
            const items = [...COURSE_LINKS[category]].sort((a, b) =>
              a.title.localeCompare(b.title),
            )
            return (
              <section key={category} className="pixel-panel rounded-lg p-3">
                <h3 className="mb-2 text-sm font-semibold text-[var(--pixel-accent)]">{category}</h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <a
                      key={`${category}-${item.title}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="pixel-panel block rounded p-2 text-xs text-[var(--pixel-ink)] transition-colors hover:bg-[#edf3ff]"
                    >
                      <div className="font-medium">{item.title}</div>
                      <div className="text-[11px] text-[var(--pixel-ink-muted)]">{item.provider}</div>
                    </a>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : null}

      {activeTab === 'books' ? (
        <div className="flex flex-1 min-h-0 flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input
              className="pixel-input rounded px-3 py-2 text-xs placeholder:text-[var(--pixel-ink-muted)]"
              placeholder="Search by title or author"
              value={bookSearch}
              onChange={(event) => setBookSearch(event.target.value)}
            />
            <select
              className="pixel-input rounded px-3 py-2 text-xs"
              value={bookCategory}
              onChange={(event) => setBookCategory(event.target.value)}
            >
              {bookCategories.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
            <select
              className="pixel-input rounded px-3 py-2 text-xs"
              value={bookAuthor}
              onChange={(event) => setBookAuthor(event.target.value)}
            >
              {bookAuthors.map((author) => (
                <option key={author} value={author}>
                  {author === 'all' ? 'All Authors' : author}
                </option>
              ))}
            </select>
          </div>

          <div className="grid flex-1 min-h-0 grid-cols-1 gap-2 md:grid-cols-2">
            {filteredBooks.length === 0 ? (
              <div className="pixel-panel rounded p-3 text-xs text-[var(--pixel-ink-muted)]">
                No books matched your search and filters.
              </div>
            ) : (
              filteredBooks.map((book) => (
                <article key={book.id} className="pixel-panel rounded p-3">
                  <h3 className="text-sm font-semibold text-[var(--pixel-accent)]">{book.title}</h3>
                  <p className="mt-1 text-xs text-[var(--pixel-ink)]">by {book.author}</p>
                  <p className="mt-1 text-[11px] text-[var(--pixel-ink-muted)]">
                    {book.category} | {book.year} | {book.language}
                  </p>
                  <a
                    href={book.pdfPath}
                    target="_blank"
                    rel="noreferrer"
                    className="pixel-button mt-3 inline-flex rounded px-2 py-1 text-[10px]"
                  >
                    Read PDF
                  </a>
                </article>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'news' ? (
        <div className="flex flex-1 min-h-0 flex-col gap-3">
          <div className="pixel-panel flex items-center justify-between rounded px-3 py-2 text-xs text-[var(--pixel-ink)]">
            <div>Last refreshed: {new Date(lastNewsRefreshAt).toLocaleString()}</div>
            <button
              type="button"
              className="pixel-button rounded px-2 py-1 text-[9px]"
              onClick={() => setLastNewsRefreshAt(Date.now())}
            >
              Refresh List
            </button>
          </div>
          <div className="grid flex-1 min-h-0 grid-cols-1 gap-2 md:grid-cols-2">
            {NEWS_ITEMS.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="pixel-panel rounded p-3 text-xs text-[var(--pixel-ink)] transition-colors hover:bg-[#edf3ff]"
              >
                <div className="text-[11px] uppercase tracking-wide text-[var(--pixel-ink-muted)]">
                  {item.kind} | {item.source}
                </div>
                <h3 className="mt-1 text-sm font-semibold text-[var(--pixel-accent)]">{item.title}</h3>
                <div className="mt-1 text-[11px] text-[var(--pixel-ink-muted)]">{item.publishedAt}</div>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'company' ? (
        role === 'public' ? (
          <div className="pixel-panel rounded-lg border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Company documents are restricted. Switch access to Employee or Admin.
          </div>
        ) : (
          <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 md:grid-cols-2">
            <DocColumn title="Policies" docs={groupedCompanyDocs.policy} />
            <DocColumn title="Revenue" docs={groupedCompanyDocs.revenue} />
            <DocColumn title="Audits" docs={groupedCompanyDocs.audit} />
            <DocColumn title="Archives" docs={groupedCompanyDocs.archive} />
            <DocColumn title="Bulletin Board" docs={groupedCompanyDocs.bulletin} fullWidth />
          </div>
        )
      ) : null}
      </div>
    </div>
  )
}

function DocColumn({
  title,
  docs,
  fullWidth = false,
}: {
  title: string
  docs: CompanyDoc[]
  fullWidth?: boolean
}) {
  return (
    <section
      className={`pixel-panel rounded-lg p-3 ${
        fullWidth ? 'md:col-span-2' : ''
      }`}
    >
      <h3 className="mb-2 text-sm font-semibold text-[var(--pixel-accent)]">{title}</h3>
      <div className="space-y-2">
        {docs.map((doc) => (
          <article key={doc.id} className="pixel-panel rounded p-2 text-xs text-[var(--pixel-ink)]">
            <div className="font-medium">{doc.title}</div>
            <div className="text-[11px] text-[var(--pixel-ink-muted)]">{doc.dateLabel}</div>
            <div className="mt-1 text-[11px] text-[var(--pixel-ink)]">{doc.summary}</div>
            {doc.url ? (
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="pixel-button mt-2 inline-flex rounded px-2 py-1 text-[9px]"
              >
                Open Document
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
