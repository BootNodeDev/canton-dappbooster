import { useEffect, useRef } from 'react'

// Whether the component is still on screen, for a step that runs after an await. A dialog stays
// dismissible over the wallet prompt, so its submission can resolve into a component the user has
// already replaced, and closing then closes whichever dialog took its place.
//
// Set in the effect body and not only cleared in its cleanup: StrictMode runs setup, cleanup, setup
// on mount, so a ref the cleanup alone touches reads false from the first render onwards.
export const useOnScreen = (): React.RefObject<boolean> => {
  const onScreen = useRef(true)
  useEffect(() => {
    onScreen.current = true
    return () => {
      onScreen.current = false
    }
  }, [])
  return onScreen
}
