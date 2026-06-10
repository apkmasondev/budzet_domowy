import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// --- ZAPYTANIA (QUERIES) ---

export const useAccounts = () => {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: api.getAccounts,
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });
};

export const useTransactions = () => {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: api.getTransactions,
  });
};

export const useBudgets = (month: string) => {
  return useQuery({
    queryKey: ["budgets", month],
    queryFn: () => api.getBudgets(month),
  });
};

export const useAllBudgets = () => {
  return useQuery({
    queryKey: ["budgets", "all"],
    queryFn: api.getAllBudgets,
  });
};

export const useGoals = () => {
  return useQuery({
    queryKey: ["goals"],
    queryFn: api.getGoals,
  });
};

export const useRecurrings = () => {
  return useQuery({
    queryKey: ["recurrings"],
    queryFn: api.getRecurrings,
  });
};

export const useTags = () => {
  return useQuery({
    queryKey: ["tags"],
    queryFn: api.getTags,
  });
};

// --- MUTACJE (MUTATIONS) ---

export const useAddTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createTransaction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      if (variables.type === 'expense') {
        queryClient.invalidateQueries({ queryKey: ["budgets"] });
      }
      if (variables.tags && variables.tags.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["tags"] });
      }
    },
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: Parameters<typeof api.updateTransaction>[1] }) => api.updateTransaction(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
};

export const useBulkAddTransactions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.bulkInsertTransactions,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      if (variables.some(v => v.type === 'expense')) {
        queryClient.invalidateQueries({ queryKey: ["budgets"] });
      }
      if (variables.some(v => v.tags && v.tags.length > 0)) {
        queryClient.invalidateQueries({ queryKey: ["tags"] });
      }
    },
  });
};

export const useAddAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
};

export const useUpdateAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: Parameters<typeof api.updateAccount>[1] }) => api.updateAccount(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};

export const useUpsertBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.upsertBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
};

export const useCopyBudgets = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fromMonth, toMonth }: { fromMonth: string, toMonth: string }) => api.copyBudgetsToMonth(fromMonth, toMonth),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["budgets", variables.toMonth] });
    },
  });
};

export const useCreateGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
};

export const useUpdateGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: Parameters<typeof api.updateGoal>[1] }) => api.updateGoal(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
};

export const useDeleteGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
};

export const useAddToGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.addToGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, type, color }: { name: string, type: string, color: string }) => api.createCategory(name, type, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
};

export const useAddRecurring = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createRecurring,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurrings"] });
      queryClient.invalidateQueries({ queryKey: ["recurringSuggestions"] });
    },
  });
};

export const useUpdateRecurring = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: Parameters<typeof api.updateRecurring>[1] }) => api.updateRecurring(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurrings"] });
    },
  });
};

export const useDeleteRecurring = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteRecurring,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurrings"] });
    },
  });
};

export const useRecurringSuggestions = () => {
  return useQuery({
    queryKey: ["recurringSuggestions"],
    queryFn: api.detectSuggestions,
  });
};

export const useIgnoreSubscriptionSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.ignoreSubscriptionSuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringSuggestions"] });
    },
  });
};
