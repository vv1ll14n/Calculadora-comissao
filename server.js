const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cache/Read articles helper
const getArticles = () => {
  const filePath = path.join(__dirname, 'data', 'articles.json');
  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(rawData);
  } catch (err) {
    console.error('Erro ao ler data/articles.json:', err);
    return [];
  }
};

/**
 * Rota GET /api/articles
 * Retorna os 4 artigos educativos sobre gestão financeira de comissão
 */
app.get('/api/articles', (req, res) => {
  const articles = getArticles();
  res.json({ success: true, data: articles });
});

/**
 * Rota GET /api/articles/:id
 * Retorna um artigo específico por ID
 */
app.get('/api/articles/:id', (req, res) => {
  const articles = getArticles();
  const article = articles.find((a) => a.id === req.params.id);
  if (!article) {
    return res.status(404).json({ success: false, message: 'Artigo não encontrado' });
  }
  res.json({ success: true, data: article });
});

/**
 * Rota POST /api/calculate
 * Processa as regras de negócio de nivelamento de renda e saúde financeira
 */
app.post('/api/calculate', (req, res) => {
  try {
    const {
      grossIncome = 0,
      taxAndCostRate = 6,
      essentialCost = 0,
      targetSalary = 0,
      lowMonthAverage = 0,
      currentBuffer = 0,
      commissionRate = 5,
      strategyProfile = 'balanced'
    } = req.body;

    // Normalização numérica
    const numGross = Math.max(0, parseFloat(grossIncome) || 0);
    const numTaxRate = Math.min(35, Math.max(0, parseFloat(taxAndCostRate) || 0));
    const numEssential = Math.max(0, parseFloat(essentialCost) || 0);
    const numTarget = Math.max(0, parseFloat(targetSalary) || 0);
    const numLowMonth = Math.max(0, parseFloat(lowMonthAverage) || 0);
    const numCurrentBuffer = Math.max(0, parseFloat(currentBuffer) || 0);
    const numCommissionRate = Math.max(0, parseFloat(commissionRate) || 0);
    const strategy = ['shield', 'balanced', 'wealth'].includes(strategyProfile)
      ? strategyProfile
      : 'balanced';

    // 1. Renda Líquida Real
    const taxDeducted = numGross * (numTaxRate / 100);
    const netIncome = Math.max(0, numGross - taxDeducted);

    // 2. Análise de Cenário do Mês
    let status = 'surplus'; // 'surplus' | 'drawdown' | 'critical'
    let statusLabel = '';
    let statusDescription = '';
    let surplus = 0;
    let bufferAllocation = 0;
    let rewardBonus = 0;
    let wealthBonus = 0;
    let bufferWithdrawal = 0;
    let guaranteedSalary = numTarget;

    // Definição das taxas de alocação de acordo com o perfil
    const strategyRates = {
      shield: { buffer: 0.75, reward: 0.10, wealth: 0.15 },
      balanced: { buffer: 0.60, reward: 0.15, wealth: 0.25 },
      wealth: { buffer: 0.40, reward: 0.20, wealth: 0.40 }
    };
    const currentRates = strategyRates[strategy];

    if (netIncome > numTarget) {
      // Cenário 1: Mês de Alta
      status = 'surplus';
      statusLabel = 'Mês de Alta: Excedente Gerado';
      statusDescription = 'Sua renda líquida superou o Salário Estável. O excedente foi particionado para blindar seu futuro, garantir lazer sem culpa e acelerar seu patrimônio.';
      surplus = netIncome - numTarget;
      bufferAllocation = surplus * currentRates.buffer;
      rewardBonus = surplus * currentRates.reward;
      wealthBonus = surplus * currentRates.wealth;
      bufferWithdrawal = 0;
      guaranteedSalary = numTarget;
    } else if (netIncome >= numEssential) {
      // Cenário 2: Mês na Meta ou Abaixo da Meta (mas acima do Essencial)
      status = 'drawdown';
      statusLabel = 'Mês Abaixo da Meta: Ativação do Colchão';
      statusDescription = 'Sua renda deste mês ficou abaixo da sua meta mensal. Resgate a complementação indicada do seu Colchão de Sazonalidade para manter o seu padrão de vida estável.';
      surplus = 0;
      bufferAllocation = 0;
      rewardBonus = 0;
      wealthBonus = 0;
      bufferWithdrawal = Math.max(0, numTarget - netIncome);
      guaranteedSalary = numTarget;
    } else {
      // Cenário 3: Mês Crítico (Abaixo do Custo Essencial)
      status = 'critical';
      statusLabel = 'Alerta de Mês Fraco: Modo Contenção';
      statusDescription = 'A receita líquida não cobriu o custo de sobrevivência essencial. Acione a retirada de socorro do Colchão para cobrir as contas básicas e restrinja gastos supérfluos.';
      surplus = 0;
      bufferAllocation = 0;
      rewardBonus = 0;
      wealthBonus = 0;
      bufferWithdrawal = Math.max(0, numTarget - netIncome);
      guaranteedSalary = numTarget;
    }

    // 3. Termômetro de Blindagem e Autonomia (Runway)
    const newBufferTotal = Math.max(0, numCurrentBuffer + bufferAllocation - bufferWithdrawal);
    const monthlyGap = Math.max(numTarget - numLowMonth, numEssential * 0.5, 1);
    const idealBufferGoal = monthlyGap * 6;
    const shieldProgress = idealBufferGoal > 0
      ? Math.min(100, Math.round((newBufferTotal / idealBufferGoal) * 100))
      : 100;

    const monthsSurvivingLow = monthlyGap > 0
      ? Math.floor((newBufferTotal / monthlyGap) * 10) / 10
      : 0;

    const monthsZeroSales = numEssential > 0
      ? (newBufferTotal / numEssential).toFixed(1)
      : '0.0';

    // 4. Calculadora Reversa de Vendas (Meta Comercial)
    const taxFactor = 1 - (numTaxRate / 100);
    const neededGrossIncome = taxFactor > 0 ? numTarget / taxFactor : 0;
    const salesVolumeNeeded = numCommissionRate > 0
      ? neededGrossIncome / (numCommissionRate / 100)
      : 0;

    // 5. Decomposição para Barra de Alocação Visual (em percentuais e valores)
    // Se a receita bruta for zero ou menor que impostos, trata com segurança
    const totalRepresented = Math.max(numGross, 1);
    const allocationBreakdown = {
      tax: {
        value: taxDeducted,
        percentage: Number(((taxDeducted / totalRepresented) * 100).toFixed(1)),
        label: 'Impostos & Custos'
      },
      salary: {
        value: Math.min(netIncome, numTarget),
        percentage: Number(((Math.min(netIncome, numTarget) / totalRepresented) * 100).toFixed(1)),
        label: 'Salário Estável (Conta PF)'
      },
      buffer: {
        value: bufferAllocation,
        percentage: Number(((bufferAllocation / totalRepresented) * 100).toFixed(1)),
        label: 'Colchão de Sazonalidade'
      },
      reward: {
        value: rewardBonus,
        percentage: Number(((rewardBonus / totalRepresented) * 100).toFixed(1)),
        label: 'Lazer Livre (Sem Culpa)'
      },
      wealth: {
        value: wealthBonus,
        percentage: Number(((wealthBonus / totalRepresented) * 100).toFixed(1)),
        label: 'Patrimônio / 13º'
      }
    };

    return res.json({
      success: true,
      data: {
        inputs: {
          grossIncome: numGross,
          taxAndCostRate: numTaxRate,
          essentialCost: numEssential,
          targetSalary: numTarget,
          lowMonthAverage: numLowMonth,
          currentBuffer: numCurrentBuffer,
          commissionRate: numCommissionRate,
          strategyProfile: strategy
        },
        financials: {
          taxDeducted,
          netIncome,
          guaranteedSalary,
          surplus,
          bufferAllocation,
          bufferWithdrawal,
          rewardBonus,
          wealthBonus,
          newBufferTotal,
          monthlyGap,
          idealBufferGoal,
          shieldProgress,
          monthsSurvivingLow,
          monthsZeroSales: parseFloat(monthsZeroSales),
          neededGrossIncome,
          salesVolumeNeeded
        },
        status: {
          code: status,
          label: statusLabel,
          description: statusDescription,
          rates: currentRates
        },
        allocationBreakdown
      }
    });
  } catch (error) {
    console.error('Erro na rota /api/calculate:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao processar cálculos financeiros.',
      error: error.message
    });
  }
});

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia servidor
app.listen(PORT, () => {
  console.log(`✓ Servidor ComissãoEstável rodando em: http://localhost:${PORT}`);
});
