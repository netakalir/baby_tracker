import { useId, useState } from 'react'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import type { CitySearchResult } from './api'
import type { SavedCity } from './savedCity'
import { useCitySearch } from './useCitySearch'

interface CitySearchProps {
  onChoose: (city: SavedCity) => void
}

/**
 * The "choose a city" search inside the weather panel: a text field with a
 * debounced lookup (see `useCitySearch`) and a short list of matches. Picking
 * one hands it to `onChoose`, which saves it on this device.
 */
export function CitySearch({ onChoose }: CitySearchProps) {
  const inputId = useId()
  const statusId = useId()
  const [term, setTerm] = useState('')
  const { results, isActive, isSearching, isError } = useCitySearch(term)

  let status: string | null = null
  if (isError) status = 'החיפוש לא זמין כרגע'
  else if (isSearching && results.length === 0) status = 'מחפש…'
  else if (isActive && !isSearching && results.length === 0) status = 'לא נמצאו ערים בשם הזה'

  const choose = (result: CitySearchResult): void => {
    onChoose({ name: result.name, latitude: result.latitude, longitude: result.longitude })
  }

  return (
    <div>
      <Label htmlFor={inputId}>חיפוש עיר</Label>
      <Input
        id={inputId}
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="לדוגמה: רעננה"
        autoComplete="off"
        enterKeyHint="search"
        aria-describedby={statusId}
        // The panel opens in response to a tap on "בחרו עיר" / "החלף עיר", so
        // moving focus straight into the field is the expected next step.
        autoFocus
      />

      <p id={statusId} aria-live="polite" className="mt-2 text-xs text-neutral-600 empty:hidden">
        {status}
      </p>

      {results.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1" aria-label="תוצאות חיפוש">
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => choose(result)}
                className="flex w-full flex-col items-start rounded-sm px-2 py-2 text-start transition-colors duration-fast hover:bg-neutral-100 active:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <span className="text-sm font-medium text-neutral-900">{result.name}</span>
                {result.region && (
                  <span className="text-xs text-neutral-400">{result.region}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
