import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useMemo } from 'react';
import type { Transaction } from '../../types';
import { useCategories } from '../../lib/queries';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#10b981', '#14b8a6', '#0ea5e9'];

interface Props {
  month?: string; // Optional for backwards compatibility, if missing we do all time
  transactions?: Transaction[];
}

export default function SpendingPieChart({ month, transactions = [] }: Props) {
  const { data: categories = [] } = useCategories();
  const { privacyMode } = useFinanceStore();

  const data = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense' && (!month || t.date.startsWith(month)));
    
    const byCategory = expenses.reduce((acc: Record<number, number>, curr) => {
      const catId = curr.category_id || 0;
      acc[catId] = (acc[catId] || 0) + curr.amount;
      return acc;
    }, {});

    return Object.entries(byCategory)
      .map(([id, value]) => {
        const cat = categories.find(c => c.id === parseInt(id));
        return {
          name: cat?.name || 'Inne',
          value,
          color: cat?.color || COLORS[parseInt(id) % COLORS.length]
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories, month]);

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center border border-dashed border-border rounded-xl">
        <p className="text-muted-foreground text-sm">Brak wydatków w tym miesiącu</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-4 rounded-xl shadow-xl ring-1 ring-black/5">
          <p className="font-semibold mb-1" style={{ color: payload[0].payload.color }}>
            {payload[0].name}
          </p>
          <p className="text-xl font-bold">
            {privacyMode ? '***' : payload[0].value.toFixed(2)} PLN
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full print:h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '13px', fontWeight: 500 }} formatter={(value) => <span style={{ color: 'var(--color-foreground)' }}>{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
