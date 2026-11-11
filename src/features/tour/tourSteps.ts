/**
 * The app tour's content: a short, fixed walk through the Today screen.
 *
 * Each step either points at an element on the page (its `anchor`, matched by
 * the `data-tour` attribute set with `tourAnchor`) or, with no anchor, shows
 * centred on the screen. The text is plain, short Hebrew - one idea per step.
 */

/** The Today-screen regions the tour can point at. */
export type TourAnchorId = 'clock' | 'quick-log' | 'estimates' | 'weather' | 'menu'

export interface TourStep {
  readonly id: string
  readonly title: string
  readonly body: string
  /** The element to highlight; omitted for a centred, anchor-less step. */
  readonly anchor?: TourAnchorId
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    title: 'ברוכים הבאים 👋',
    body: 'סיור קצר על המסך הראשי, פחות מדקה. אפשר לדלג בכל רגע.',
  },
  {
    id: 'clock',
    anchor: 'clock',
    title: 'השעון היומי',
    body: 'כל 24 השעות של היום במבט אחד. לכל סוג אירוע צבע משלו: שינה, האכלה, החתלה ומצב רוח.',
  },
  {
    id: 'quick-log',
    anchor: 'quick-log',
    title: 'רישום בנגיעה אחת',
    body: 'החתלה ומצב רוח נרשמים מיד. שינה והאכלה מפעילות טיימר, ונגיעה נוספת עוצרת אותו.',
  },
  {
    id: 'estimates',
    anchor: 'estimates',
    title: 'ההאכלה והשינה הבאות',
    body: 'הערכה של מתי יגיעו, לפי הקצב של הימים האחרונים וההמלצות המקובלות לגיל.',
  },
  {
    id: 'weather',
    anchor: 'weather',
    title: 'מזג אוויר והלבשה',
    body: 'מזג האוויר עכשיו והמלצה מה להלביש. נגיעה פותחת פרטים ובחירת עיר.',
  },
  {
    id: 'menu',
    anchor: 'menu',
    title: 'עוד מסכים',
    body: 'בתפריט: סיכום שבועי, השוואת ימים והגדרות. משם אפשר גם להפעיל את הסיור שוב.',
  },
]

/** The attribute that marks an element as a tour anchor. */
const ANCHOR_ATTRIBUTE = 'data-tour'

/** Spread onto an element to make it a tour anchor: `<div {...tourAnchor('clock')}>`. */
export function tourAnchor(id: TourAnchorId): { readonly [ANCHOR_ATTRIBUTE]: TourAnchorId } {
  return { [ANCHOR_ATTRIBUTE]: id }
}

/** Finds the on-page element for an anchor, or null when it is not rendered. */
export function findTourAnchor(id: TourAnchorId): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${ANCHOR_ATTRIBUTE}="${id}"]`)
}
