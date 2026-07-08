import './Pagination.css'

interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}

function Pagination({ currentPage, totalItems, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  if (totalItems === 0) return null

  const rangeStart = (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(totalItems, currentPage * pageSize)

  const pageNumbers: number[] = []
  const windowSize = 2
  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || (p >= currentPage - windowSize && p <= currentPage + windowSize)) {
      pageNumbers.push(p)
    }
  }

  return (
    <div className="pagination-bar">
      <span className="pagination-range">
        Showing <strong>{rangeStart}-{rangeEnd}</strong> of <strong>{totalItems}</strong>
      </span>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn pagination-nav"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {pageNumbers.map((page, idx) => {
          const prev = pageNumbers[idx - 1]
          const showEllipsis = prev !== undefined && page - prev > 1
          return (
            <span key={page} className="pagination-page-group">
              {showEllipsis && <span className="pagination-ellipsis">…</span>}
              <button
                type="button"
                className={`pagination-btn pagination-page${page === currentPage ? ' is-active' : ''}`}
                onClick={() => onPageChange(page)}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            </span>
          )
        })}

        <button
          type="button"
          className="pagination-btn pagination-nav"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default Pagination
