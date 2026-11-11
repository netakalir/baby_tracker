import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { clearTourRequest } from '../tour/tourStart'
import { signOut } from './api'

/**
 * Signs the current user out and returns them to the auth screen. Clears the
 * whole react-query cache so no data belonging to the signed-out user lingers
 * for the next session (and drops any pending app-tour start). Shared by every place that offers a "log out" action
 * (the Today header, the Settings hub) so the behaviour stays identical.
 */
export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.clear()
      clearTourRequest()
      navigate('/auth')
    },
  })
}
