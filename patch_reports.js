const fs = require('fs');
let code = fs.readFileSync('src/components/ReportsScreen.tsx', 'utf8');
code = code.replace("import { Calendar, FileBarChart, Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';", 
"import { Calendar, FileBarChart, Download, TrendingUp, TrendingDown, DollarSign, Printer } from 'lucide-react';\nimport { ClosingReportReceipt } from './ClosingReportReceipt';");

// replace closing section
const closingStart = code.indexOf("if (reportType === 'closing') {");
const closingEnd = code.indexOf("if (reportType === 'employees') {");

const newClosingCode = `if (reportType === 'closing') {
    const filteredTransactions = transactions.filter((t: Transaction) => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });
    const filteredInvoices = invoices.filter((i: Invoice) => {
      const d = new Date(i.date);
      return d >= start && d <= end;
    });

    const dateLabel = start.toISOString().split('T')[0] === end.toISOString().split('T')[0] 
      ? start.toISOString().split('T')[0] 
      : \`\${start.toISOString().split('T')[0]} - \${end.toISOString().split('T')[0]}\`;

    return (
      <div className="flex flex-col items-center py-8 bg-slate-200">
        <button onClick={() => window.print()} className="mb-6 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 print:hidden">
          <Printer size={18} /> طباعة التقرير
        </button>
        <div className="bg-white shadow-xl">
          <ClosingReportReceipt 
            settings={settings} 
            transactions={filteredTransactions} 
            invoices={filteredInvoices} 
            dateLabel={dateLabel} 
          />
        </div>
      </div>
    );
  }

  `;

code = code.substring(0, closingStart) + newClosingCode + code.substring(closingEnd);

fs.writeFileSync('src/components/ReportsScreen.tsx', code);
