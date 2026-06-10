import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanceStore } from '../../store/useFinanceStore';
import type { Transaction } from '../../types';

interface Props {
  monthsCount?: number;
  transactions?: Transaction[];
}

export default function MonthlyCashFlowChart({ monthsCount = 6, transactions = [] }: Props) {
  const { privacyMode } = useFinanceStore();

  const data = useMemo(() => {
    const months: string[] = [];
    const d = new Date();
    for (let i = monthsCount - 1; i >= 0; i--) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const year = past.getFullYear();
      const month = String(past.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }

    return months.map(month => {
      const txs = transactions.filter(t => t.date.startsWith(month) && t.type !== 'transfer');
      const income = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      
      return {
        name: month,
        Przychody: income,
        Wydatki: expense,
        NetFlow: income - expense
      };
    });
  }, [transactions, monthsCount]);

  const navigate = useNavigate();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-4 rounded-xl shadow-xl ring-1 ring-black/5">
          <p className="font-semibold text-foreground mb-3 text-sm">{label}</p>
          <div className="space-y-1.5">
            {payload.map((p: any, i: number) => (
              <div key={i} className="flex justify-between items-center gap-4 text-sm font-medium">
                <span style={{ color: p.color }}>{p.name}</span>
                <span className="text-foreground">{privacyMode ? '***' : p.value?.toFixed(2)} PLN</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full print:h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          barGap={6}
        >
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff10', rx: 4 }} />
          <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '13px', fontWeight: 500 }} formatter={(value) => <span style={{ color: 'var(--color-foreground)' }}>{value}</span>} />
          <Bar 
            dataKey="Przychody" 
            fill="#10b981" 
            radius={[4, 4, 0, 0]} 
            maxBarSize={45} 
            className="cursor-pointer transition-opacity hover:opacity-85"
            onClick={(data) => data?.name && navigate(`/transactions?month=${data.name}&type=income`)}
          />
          <Bar 
            dataKey="Wydatki" 
            fill="#ef4444" 
            radius={[4, 4, 0, 0]} 
            maxBarSize={45} 
            className="cursor-pointer transition-opacity hover:opacity-85"
            onClick={(data) => data?.name && navigate(`/transactions?month=${data.name}&type=expense`)}
          />
          <Line type="monotone" dataKey="NetFlow" name="Zysk Netto" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
