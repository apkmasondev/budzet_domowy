import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import type { Transaction, Account } from '../../types';

interface Props {
  monthsCount?: number;
  transactions?: Transaction[];
  accounts?: Account[];
}

export default function BalanceTrendChart({ monthsCount = 6, transactions = [], accounts = [] }: Props) {
  const { privacyMode } = useFinanceStore();

  const data = useMemo(() => {
    // 1. Current total balance
    const currentBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

    // 2. Group transactions by month
    const months: string[] = [];
    const d = new Date();
    for (let i = monthsCount - 1; i >= 0; i--) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const year = past.getFullYear();
      const month = String(past.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }

    // 3. To find historical balance, we subtract net flow from current balance backwards
    // Wait, it's easier to find net flow of each month, then work backwards from current balance
    // Net Flow = Income - Expense for the month
    const monthlyNetFlows: Record<string, number> = {};
    
    // Calculate net flow for ALL months we have data for, to properly step back
    transactions.forEach(t => {
      const m = t.date.substring(0, 7);
      if (!monthlyNetFlows[m]) monthlyNetFlows[m] = 0;
      if (t.type === 'income') monthlyNetFlows[m] += t.amount;
      if (t.type === 'expense') monthlyNetFlows[m] -= t.amount;
    });

    // Now work backwards to find balance at the END of each month
    // The current balance is the balance at the end of the current month
    // We only need the chart data for the requested `monthsCount`
    const chartData = [];
    
    // This isn't perfectly accurate if we don't have all historical transactions 
    // to step back to the beginning of time. But it assumes current balance minus
    // recent transactions equals historical balance.
    
    // A better approach: 
    // We know runningBalance is at the end of the very latest month.
    // If we step back one month, balance at end of (m-1) = balance at end of m - netFlow(m)
    
    const dNow = new Date();
    const currentMonthStr = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}`;
    
    let tempBalance = currentBalance;
    const balanceByMonth: Record<string, number> = {};
    balanceByMonth[currentMonthStr] = tempBalance;

    let currentIterMonth = new Date(dNow.getFullYear(), dNow.getMonth(), 1);
    
    for (let i = 0; i <= monthsCount; i++) {
      const mStr = `${currentIterMonth.getFullYear()}-${String(currentIterMonth.getMonth() + 1).padStart(2, '0')}`;
      const prevMonth = new Date(currentIterMonth.getFullYear(), currentIterMonth.getMonth() - 1, 1);
      const prevMStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
      
      const net = monthlyNetFlows[mStr] || 0;
      tempBalance -= net;
      balanceByMonth[prevMStr] = tempBalance;
      
      currentIterMonth = prevMonth;
    }

    // Now build the forward-facing array for the chart
    for (let i = monthsCount - 1; i >= 0; i--) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const year = past.getFullYear();
      const monthStr = String(past.getMonth() + 1).padStart(2, '0');
      const mKey = `${year}-${monthStr}`;
      
      chartData.push({
        name: mKey,
        Saldo: balanceByMonth[mKey] || 0
      });
    }

    return chartData;
  }, [transactions, accounts, monthsCount]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-4 rounded-xl shadow-xl ring-1 ring-black/5">
          <p className="font-semibold text-foreground mb-2 text-sm">{label}</p>
          <div className="flex justify-between items-center gap-4 text-sm font-medium">
            <span style={{ color: payload[0].color }}>{payload[0].name}</span>
            <span className="text-foreground">{privacyMode ? '***' : payload[0].value?.toFixed(2)} PLN</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full print:h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ffffff20', strokeWidth: 2 }} />
          <Line 
            type="monotone" 
            dataKey="Saldo" 
            stroke="#6366f1" 
            strokeWidth={4}
            dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
