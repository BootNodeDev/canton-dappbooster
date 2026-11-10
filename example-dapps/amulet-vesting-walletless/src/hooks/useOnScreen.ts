import { useEffect, useRef } from 'react'

// Whether the component is still on screen, for a step that runs after an await.
export const useOnScreen = (): React.RefObject<boolean> => {
  const onScreen = useRef(true)
  useEffect(() => {
    // StrictMode runs setup, cleanup, setup on mount, so a cleanup alone would leave it false.
    onScreen.current = true
    return () => {
      onScreen.current = false
    }
  }, [])
  return onScreen
}
