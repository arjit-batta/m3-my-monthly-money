import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  withErrorHandling, 
  withIdempotency, 
  generateIdempotencyKey,
  DbResult 
} from '@/lib/db-utils';

interface MutationOptions<TData, TVariables> {
  /** Function that performs the mutation */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Called on successful mutation */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Called on failed mutation */
  onError?: (error: string, variables: TVariables) => void;
  /** Success toast message */
  successMessage?: string;
  /** Error toast message prefix */
  errorMessagePrefix?: string;
  /** Operation name for idempotency (if provided, enables duplicate prevention) */
  idempotencyOperation?: string;
}

interface MutationState<TData> {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: string | null;
  data: TData | null;
}

export function useMutation<TData, TVariables extends Record<string, unknown>>(
  options: MutationOptions<TData, TVariables>
) {
  const { toast } = useToast();
  const [state, setState] = useState<MutationState<TData>>({
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: null,
  });

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  const mutate = useCallback(
    async (variables: TVariables): Promise<DbResult<TData>> => {
      setState({
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: null,
        data: null,
      });

      const operation = async () => {
        return options.mutationFn(variables);
      };

      // Wrap with idempotency if operation name provided
      const wrappedOperation = options.idempotencyOperation
        ? () => {
            const key = generateIdempotencyKey(options.idempotencyOperation!, variables);
            return withIdempotency(key, operation);
          }
        : operation;

      const result = await withErrorHandling(wrappedOperation);

      if (!isMounted.current) return result;

      if (result.success === true) {
        setState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          data: result.data,
        });

        if (options.successMessage) {
          toast({ title: options.successMessage, duration: 2000 });
        }

        options.onSuccess?.(result.data, variables);
      } else {
        // result.success === false
        const failedResult = result as { success: false; error: string; isNetworkError: boolean };
        
        setState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: failedResult.error,
          data: null,
        });

        const displayMessage = options.errorMessagePrefix
          ? `${options.errorMessagePrefix}: ${failedResult.error}`
          : failedResult.error;

        toast({ 
          title: failedResult.isNetworkError ? 'Connection Error' : 'Error',
          description: displayMessage,
          variant: 'destructive',
          duration: 4000,
        });

        options.onError?.(failedResult.error, variables);
      }

      return result;
    },
    [options, toast]
  );

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: null,
    });
  }, []);

  return {
    mutate,
    reset,
    ...state,
  };
}

// Simpler hook for mutations that don't need full state tracking
export function useSimpleMutation<TData, TVariables extends Record<string, unknown>>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    successMessage?: string;
    errorMessagePrefix?: string;
    onSuccess?: (data: TData) => void;
    onError?: (error: string) => void;
  } = {}
) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (variables: TVariables): Promise<DbResult<TData>> => {
      setIsLoading(true);

      const result = await withErrorHandling(() => mutationFn(variables));

      setIsLoading(false);

      if (result.success === true) {
        if (options.successMessage) {
          toast({ title: options.successMessage, duration: 2000 });
        }
        options.onSuccess?.(result.data);
      } else {
        // result.success === false
        const failedResult = result as { success: false; error: string; isNetworkError: boolean };
        
        toast({
          title: failedResult.isNetworkError ? 'Connection Error' : 'Error',
          description: options.errorMessagePrefix 
            ? `${options.errorMessagePrefix}: ${failedResult.error}`
            : failedResult.error,
          variant: 'destructive',
          duration: 4000,
        });
        options.onError?.(failedResult.error);
      }

      return result;
    },
    [mutationFn, options, toast]
  );

  return { mutate, isLoading };
}
