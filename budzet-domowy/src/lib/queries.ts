import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData,
  type QueryClient,
} from "@tanstack/react-query";
import { api } from "./api";

export const TRANSACTIONS_PAGE_SIZE = 50;

/**
 * Limit dla zapytań "wszystko naraz" (wykresy, raporty, wykrywanie duplikatów).
 * Backend przyjmuje `u32`, więc nie można tu wstawić Number.MAX_SAFE_INTEGER —
 * przekroczenie zakresu wywala deserializację po stronie Rusta.
 */
const ALL_TRANSACTIONS_LIMIT = 1_000_000;

/**
 * Wszystkie klucze zapytań w jednym miejscu.
 *
 * Kluczowa zasada: każde zapytanie dotyczące transakcji zaczyna się od "transactions",
 * dzięki czemu pojedyncze `invalidateQueries({ queryKey: ["transactions"] })` odświeża
 * listę, wykresy i podglądy kont naraz. Wcześniej były to trzy niezależne klucze
 * ("transactions", "importTransactions", "dashboardChartTransactions", "reportTransactions"),
 * z których część nie była unieważniana przez żadną mutację — wykresy i Dashboard
 * potrafiły pokazywać dane sprzed dodania transakcji.
 */
export const queryKeys = {
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  tags: ["tags"] as const,
  goals: ["goals"] as const,
  recurrings: ["recurrings"] as const,
  recurringSuggestions: ["recurringSuggestions"] as const,
  readyToAssign: ["readyToAssign"] as const,
  budgetStates: ["budgetStates"] as const,
  transactions: ["transactions"] as const,
  transactionsList: (search?: string, month?: string, txType?: string, sortBy?: string) =>
    ["transactions", "list", search ?? "", month ?? "", txType ?? "", sortBy ?? ""] as const,
  transactionsAll: ["transactions", "all"] as const,
  transactionsByAccount: (accountId: number | null) => ["transactions", "account", accountId] as const,
  transaction: (id: number | null) => ["transaction", id] as const,
  transactionMonths: ["transactions", "months"] as const,
  dashboardStats: (month: string) => ["dashboardStats", month] as const,
};

/**
 * Jedno miejsce, które wie co się zmienia po zapisie transakcji.
 * Wcześniej każda mutacja miała własną, ręcznie utrzymywaną listę — i każda
 * pomijała `dashboardStats` oraz listę dostępnych miesięcy.
 */
const invalidateAfterTransactionChange = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
  queryClient.invalidateQueries({ queryKey: queryKeys.budgetStates });
  queryClient.invalidateQueries({ queryKey: queryKeys.readyToAssign });
  queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
  queryClient.invalidateQueries({ queryKey: queryKeys.tags });
  queryClient.invalidateQueries({ queryKey: queryKeys.goals });
  queryClient.invalidateQueries({ queryKey: queryKeys.recurringSuggestions });
};

// --- ZAPYTANIA (QUERIES) ---

export const useAccounts = () => {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: api.getAccounts,
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: api.getCategories,
  });
};

export const useTransactions = (search?: string, month?: string, txType?: string, sortBy?: string) => {
  return useInfiniteQuery({
    queryKey: queryKeys.transactionsList(search, month, txType, sortBy),
    queryFn: ({ pageParam }) =>
      api.getTransactions(TRANSACTIONS_PAGE_SIZE, pageParam, search, month, txType, sortBy),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === TRANSACTIONS_PAGE_SIZE ? allPages.length * TRANSACTIONS_PAGE_SIZE : undefined,
    initialPageParam: 0,
    // Przy zmianie filtrów/wyszukiwania pokazujemy poprzednie wyniki zamiast pustej listy —
    // bez tego każde naciśnięcie klawisza w wyszukiwarce mrugało komunikatem "brak wyników".
    placeholderData: keepPreviousData,
  });
};

/**
 * Pełna historia transakcji dla wykresów i raportów (agregacje liczone po stronie UI).
 * Jedno zapytanie współdzielone przez Dashboard i Raporty zamiast dwóch niezależnych.
 */
export const useAllTransactions = () => {
  return useQuery({
    queryKey: queryKeys.transactionsAll,
    queryFn: () => api.getTransactions(ALL_TRANSACTIONS_LIMIT, 0),
  });
};

/** Historia pojedynczego konta — używana przez podgląd konta i wykrywanie duplikatów w imporcie. */
export const useAccountTransactions = (accountId: number | null) => {
  return useQuery({
    queryKey: queryKeys.transactionsByAccount(accountId),
    queryFn: () =>
      accountId === null
        ? Promise.resolve([])
        : api.getTransactions(ALL_TRANSACTIONS_LIMIT, 0, undefined, undefined, undefined, "date_desc", accountId),
    enabled: accountId !== null,
  });
};

export const useTransaction = (id: number | null) => {
  return useQuery({
    queryKey: queryKeys.transaction(id),
    queryFn: () => (id ? api.getTransactionById(id) : null),
    enabled: !!id,
  });
};

export const useTransactionMonths = () => {
  return useQuery({
    queryKey: queryKeys.transactionMonths,
    queryFn: api.getTransactionMonths,
  });
};

export const useDashboardStats = (month: string) => {
  return useQuery({
    queryKey: queryKeys.dashboardStats(month),
    queryFn: () => api.getDashboardStats(month),
  });
};

export const useBudgetStates = (month: string) => {
  return useQuery({
    queryKey: [...queryKeys.budgetStates, month],
    queryFn: () => api.getBudgetStates(month),
  });
};

export const useReadyToAssignData = () => {
  return useQuery({
    queryKey: queryKeys.readyToAssign,
    queryFn: api.getReadyToAssign,
  });
};

export const useGoals = () => {
  return useQuery({
    queryKey: queryKeys.goals,
    queryFn: api.getGoals,
  });
};

export const useRecurrings = () => {
  return useQuery({
    queryKey: queryKeys.recurrings,
    queryFn: api.getRecurrings,
  });
};

export const useRecurringSuggestions = () => {
  return useQuery({
    queryKey: queryKeys.recurringSuggestions,
    queryFn: api.detectSuggestions,
  });
};

export const useTags = () => {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: api.getTags,
  });
};

// --- MUTACJE (MUTATIONS) ---

export const useAddTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createTransaction,
    onSuccess: () => invalidateAfterTransactionChange(queryClient),
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof api.updateTransaction>[1] }) =>
      api.updateTransaction(id, payload),
    onSuccess: (_, variables) => {
      invalidateAfterTransactionChange(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.transaction(variables.id) });
    },
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTransaction,
    onSuccess: () => invalidateAfterTransactionChange(queryClient),
  });
};

export const useBulkAddTransactions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.bulkInsertTransactions,
    onSuccess: () => invalidateAfterTransactionChange(queryClient),
  });
};

export const useAddAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.readyToAssign });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetStates });
    },
  });
};

export const useUpdateAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof api.updateAccount>[1] }) =>
      api.updateAccount(id, payload),
    onSuccess: () => invalidateAfterTransactionChange(queryClient),
  });
};

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: () => {
      // Usunięcie konta kasuje jego transakcje i odwraca salda transferów,
      // więc dotyka praktycznie wszystkiego — łącznie z subskrypcjami (account_id -> NULL).
      invalidateAfterTransactionChange(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.recurrings });
    },
  });
};

export const useUpsertBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.upsertBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetStates });
      queryClient.invalidateQueries({ queryKey: queryKeys.readyToAssign });
    },
  });
};

export const useCopyBudgets = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fromMonth, toMonth }: { fromMonth: string; toMonth: string }) =>
      api.copyBudgetsToMonth(fromMonth, toMonth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetStates });
      queryClient.invalidateQueries({ queryKey: queryKeys.readyToAssign });
    },
  });
};

export const useCreateGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals });
    },
  });
};

export const useUpdateGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof api.updateGoal>[1] }) =>
      api.updateGoal(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals });
    },
  });
};

export const useDeleteGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteGoal,
    onSuccess: () => {
      // Usunięcie celu odpina powiązane transakcje (goal_id -> NULL), więc lista
      // transakcji też wymaga odświeżenia.
      queryClient.invalidateQueries({ queryKey: queryKeys.goals });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    },
  });
};

export const useAddToGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.addToGoal,
    onSuccess: () => invalidateAfterTransactionChange(queryClient),
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, type, color }: { name: string; type: string; color: string }) =>
      api.createCategory(name, type, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, type, color }: { id: number; name: string; type: string; color?: string }) =>
      api.updateCategory(id, name, type, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetStates });
      queryClient.invalidateQueries({ queryKey: queryKeys.readyToAssign });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteCategory,
    onSuccess: () => {
      // Kasowanie kategorii zeruje category_id w transakcjach i usuwa jej budżety.
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetStates });
      queryClient.invalidateQueries({ queryKey: queryKeys.readyToAssign });
      queryClient.invalidateQueries({ queryKey: queryKeys.recurrings });
    },
  });
};

export const useAddRecurring = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createRecurring,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurrings });
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringSuggestions });
    },
  });
};

export const useUpdateRecurring = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof api.updateRecurring>[1] }) =>
      api.updateRecurring(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurrings });
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringSuggestions });
    },
  });
};

export const useDeleteRecurring = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteRecurring,
    onSuccess: () => {
      // Skasowana subskrypcja przestaje blokować sugestię o tej samej nazwie.
      queryClient.invalidateQueries({ queryKey: queryKeys.recurrings });
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringSuggestions });
    },
  });
};

export const useIgnoreSubscriptionSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.ignoreSubscriptionSuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringSuggestions });
    },
  });
};
