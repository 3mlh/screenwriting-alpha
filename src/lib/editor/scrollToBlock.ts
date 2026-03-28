type ScrollPlacement = 'top' | 'center' | 'search-result'

interface ScrollToBlockOptions {
  placement?: ScrollPlacement
}

export function scrollToBlock(
  blockId: string,
  { placement = 'top' }: ScrollToBlockOptions = {}
): boolean {
  const el = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`)
  if (!el) return false

  const container = document.querySelector('.editor-main')
  if (!container) {
    const rect = el.getBoundingClientRect()
    const targetOffset =
      placement === 'search-result'
        ? window.innerHeight * 0.38
        : placement === 'center'
          ? window.innerHeight * 0.5
          : 16

    window.scrollTo({
      top: Math.max(window.scrollY + rect.top - targetOffset, 0),
      behavior: 'smooth',
    })
    return true
  }

  const stickyBar = container.querySelector('.block-type-selector-bar')
  const stickyHeight = stickyBar ? stickyBar.getBoundingClientRect().height : 0

  const containerRect = container.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const topInset = stickyHeight + 16
  const bottomInset = 24
  const availableHeight = Math.max(containerRect.height - topInset - bottomInset, 0)

  const anchorOffset =
    placement === 'search-result'
      ? topInset + availableHeight * 0.38
      : placement === 'center'
        ? topInset + availableHeight * 0.5
        : topInset

  const targetScrollTop =
    container.scrollTop + (elRect.top - containerRect.top) - anchorOffset

  container.scrollTo({ top: Math.max(targetScrollTop, 0), behavior: 'smooth' })
  return true
}
