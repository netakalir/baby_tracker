import type { Event } from '../../types/database'

/**
 * The interactive tour's script. The parent practises on a temporary practice
 * child (see practiceChild.ts): action steps wait for the real thing to happen
 * (an event logged, a menu opened) before moving on, and info steps just
 * explain and continue with "הבא".
 *
 * Steps point at elements marked with `tourAnchor`. The text is plain, short
 * Hebrew - one idea per step.
 */

/** The Today-screen elements the tour can point at. */
export type TourAnchorId =
  | 'clock'
  | 'estimates'
  | 'menu'
  | 'sleep-button'
  | 'diaper-button'
  | 'mood-button'
  | 'mood-menu'

/** What an action step looks at to decide it is done. */
export interface TourProgressContext {
  /** The practice child's events for today. */
  readonly events: readonly Event[]
  /** Whether an anchor is currently rendered (e.g. an open popup menu). */
  readonly isAnchorShown: (id: TourAnchorId) => boolean
}

export interface TourStep {
  readonly id: string
  readonly title: string
  readonly body: string
  /** The element to highlight; omitted for a centred step. */
  readonly anchor?: TourAnchorId
  /**
   * Present on action steps: the step completes (and the tour moves on) once
   * this returns true. Action steps have no "הבא" button.
   */
  readonly isComplete?: (context: TourProgressContext) => boolean
  /**
   * For a step whose anchor can disappear under the user (a popup menu closed
   * by an outside tap): go back one step when the anchor is gone.
   */
  readonly backWhenAnchorGone?: boolean
}

const hasEvent = (events: readonly Event[], predicate: (event: Event) => boolean): boolean =>
  events.some(predicate)

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    title: 'בואו ננסה 👋',
    body: 'נתרגל יחד על תינוק תרגול. כל מה שתרשמו עכשיו יימחק בסוף הסיור, ואף אחד אחר לא יראה אותו.',
  },
  {
    id: 'diaper',
    anchor: 'diaper-button',
    title: 'רשמו החתלה',
    body: 'נגיעה אחת בכפתור ההחתלה, וזה נרשם.',
    isComplete: ({ events }) => hasEvent(events, (event) => event.type === 'diaper'),
  },
  {
    id: 'clock',
    anchor: 'clock',
    title: 'הנה זה על השעון',
    body: 'כל אירוע מופיע על השעון היומי, בצבע של הסוג שלו.',
  },
  {
    id: 'sleep-start',
    anchor: 'sleep-button',
    title: 'התחילו שינה',
    body: 'נגעו בכפתור השינה כדי להפעיל טיימר.',
    isComplete: ({ events }) => hasEvent(events, (event) => event.type === 'sleep'),
  },
  {
    id: 'sleep-stop',
    anchor: 'sleep-button',
    title: 'עכשיו עצרו אותה',
    body: 'הטיימר רץ והקשת על השעון גדלה. נגיעה נוספת עוצרת את השינה. האכלה עובדת בדיוק כך.',
    isComplete: ({ events }) =>
      hasEvent(events, (event) => event.type === 'sleep' && event.end_time !== null),
  },
  {
    id: 'mood-open',
    anchor: 'mood-button',
    title: 'איך מרגיש התינוק?',
    body: 'נגעו בכפתור מצב הרוח.',
    isComplete: ({ events, isAnchorShown }) =>
      isAnchorShown('mood-menu') || hasEvent(events, (event) => event.type === 'mood'),
  },
  {
    id: 'mood-pick',
    anchor: 'mood-menu',
    title: 'בחרו מצב רוח',
    body: 'בחירה אחת, וזה נרשם.',
    isComplete: ({ events }) => hasEvent(events, (event) => event.type === 'mood'),
    backWhenAnchorGone: true,
  },
  {
    id: 'estimates',
    anchor: 'estimates',
    title: 'ההאכלה והשינה הבאות',
    body: 'כאן תופיע הערכה של מתי הן יגיעו. היא מתחילה אחרי כמה ימים של רישום, ומשתפרת עם הזמן.',
  },
  {
    id: 'menu',
    anchor: 'menu',
    title: 'עוד מסכים',
    body: 'בתפריט: סיכום שבועי, השוואת ימים והגדרות. משם אפשר גם לחזור על הסיור.',
  },
]

/** The attribute that marks an element as a tour anchor. */
const ANCHOR_ATTRIBUTE = 'data-tour'

/** Spread onto an element to make it a tour anchor: `<div {...tourAnchor('clock')}>`. */
export function tourAnchor(id: TourAnchorId): { readonly [ANCHOR_ATTRIBUTE]: TourAnchorId } {
  return { [ANCHOR_ATTRIBUTE]: id }
}

/** The CSS selector for an anchor. */
export function tourAnchorSelector(id: TourAnchorId): string {
  return `[${ANCHOR_ATTRIBUTE}="${id}"]`
}

/** Whether an anchor is currently rendered on the page. */
export function isTourAnchorShown(id: TourAnchorId): boolean {
  return document.querySelector(tourAnchorSelector(id)) !== null
}
