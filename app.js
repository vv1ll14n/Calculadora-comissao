/**
 * ComissãoEstável - Lógica Frontend
 * Controle de Estado, Reatividade (Debounce), LocalStorage, Formatação e Modal
 */

(function () {
  'use strict';

  // ==================== ESTADO DA APLICAÇÃO ====================
  const STORAGE_KEY = 'comissao_estavel_state_v1';

  const defaultState = {
    grossIncome: 18500,
    essentialCost: 4200,
    targetSalary: 7500,
    lowMonthAverage: 3000,
    currentBuffer: 15000,
    taxAndCostRate: 6,
    commissionRate: 5,
    strategyProfile: 'balanced' // 'shield' | 'balanced' | 'wealth'
  };

  let state = { ...defaultState };
  let currentCalculationData = null;
  let articlesData = [];
  let debounceTimer = null;

  // ==================== FORMATADORES E UTILITÁRIOS ====================
  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const formatBRL = (val) => currencyFormatter.format(Number(val) || 0);

  /**
   * Converte valor formatado (ex: "18.500,00" ou "18500") para número puro
   */
  const parseCurrencyInput = (value) => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    // Remove "R$", espaços e pontos de milhar, troca vírgula decimal por ponto
    const cleanStr = String(value)
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  /**
   * Formata número para string de input amigável (ex: 18500 -> "18.500,00")
   */
  const formatForInput = (num) => {
    const val = Number(num) || 0;
    return val.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // ==================== REFERÊNCIAS DO DOM ====================
  const dom = {
    // Inputs
    inputGrossIncome: document.getElementById('inputGrossIncome'),
    inputEssentialCost: document.getElementById('inputEssentialCost'),
    inputTargetSalary: document.getElementById('inputTargetSalary'),
    inputLowMonth: document.getElementById('inputLowMonth'),
    inputCurrentBuffer: document.getElementById('inputCurrentBuffer'),

    // Sliders
    sliderTaxRate: document.getElementById('sliderTaxRate'),
    taxRateLabel: document.getElementById('taxRateLabel'),
    sliderCommissionRate: document.getElementById('sliderCommissionRate'),
    commissionRateLabel: document.getElementById('commissionRateLabel'),

    // Estratégia
    strategyBtns: document.querySelectorAll('.strategy-btn'),
    strategyBadgeText: document.getElementById('strategyBadgeText'),
    strategyDesc: document.getElementById('strategyDesc'),

    // Ações Rápidas
    btnPresetRecord: document.getElementById('btnPresetRecord'),
    btnPresetLow: document.getElementById('btnPresetLow'),
    btnReset: document.getElementById('btnReset'),
    btnExportWhatsApp: document.getElementById('btnExportWhatsApp'),
    btnExportText: document.getElementById('btnExportText'),

    // Diagnóstico e Status
    statusBanner: document.getElementById('statusBanner'),
    statusIconContainer: document.getElementById('statusIconContainer'),
    statusIcon: document.getElementById('statusIcon'),
    statusTitle: document.getElementById('statusTitle'),
    statusBadge: document.getElementById('statusBadge'),
    statusDescText: document.getElementById('statusDescText'),

    // Cards Principais
    cardGuaranteedSalary: document.getElementById('cardGuaranteedSalary'),
    cardTaxProvision: document.getElementById('cardTaxProvision'),
    cardBufferActionBadge: document.getElementById('cardBufferActionBadge'),
    cardBufferActionIcon: document.getElementById('cardBufferActionIcon'),
    cardBufferActionSub: document.getElementById('cardBufferActionSub'),
    cardBufferValue: document.getElementById('cardBufferValue'),
    cardBufferNote: document.getElementById('cardBufferNote'),
    cardFreeBonus: document.getElementById('cardFreeBonus'),
    subRewardValue: document.getElementById('subRewardValue'),
    subWealthValue: document.getElementById('subWealthValue'),

    // Barra de Alocação
    totalIncomeHeader: document.getElementById('totalIncomeHeader'),
    barTax: document.getElementById('barTax'),
    barSalary: document.getElementById('barSalary'),
    barBuffer: document.getElementById('barBuffer'),
    barReward: document.getElementById('barReward'),
    barWealth: document.getElementById('barWealth'),
    legendTaxPct: document.getElementById('legendTaxPct'),
    legendSalaryPct: document.getElementById('legendSalaryPct'),
    legendBufferPct: document.getElementById('legendBufferPct'),
    legendRewardPct: document.getElementById('legendRewardPct'),
    legendWealthPct: document.getElementById('legendWealthPct'),

    // Termômetro
    bufferGoalProgressText: document.getElementById('bufferGoalProgressText'),
    bufferGoalComparison: document.getElementById('bufferGoalComparison'),
    shieldProgressBar: document.getElementById('shieldProgressBar'),
    metricMonthsLow: document.getElementById('metricMonthsLow'),
    metricMonthsZero: document.getElementById('metricMonthsZero'),
    metricSalesVolume: document.getElementById('metricSalesVolume'),

    // Artigos e Modal
    articlesGrid: document.getElementById('articlesGrid'),
    articleModal: document.getElementById('articleModal'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalFooterCloseBtn: document.getElementById('modalFooterCloseBtn'),
    modalCategory: document.getElementById('modalCategory'),
    modalReadTime: document.getElementById('modalReadTime'),
    modalTitle: document.getElementById('modalTitle'),
    modalContent: document.getElementById('modalContent')
  };

  // ==================== PERSISTÊNCIA LOCALSTORAGE ====================
  const loadStoredState = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        state = { ...defaultState, ...parsed };
      }
    } catch (e) {
      console.warn('Erro ao carregar dados do localStorage:', e);
      state = { ...defaultState };
    }
  };

  const saveStateToStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Erro ao salvar no localStorage:', e);
    }
  };

  // ==================== SINCRONIZAÇÃO UI -> ESTADO ====================
  const syncStateFromInputs = () => {
    state.grossIncome = parseCurrencyInput(dom.inputGrossIncome.value);
    state.essentialCost = parseCurrencyInput(dom.inputEssentialCost.value);
    state.targetSalary = parseCurrencyInput(dom.inputTargetSalary.value);
    state.lowMonthAverage = parseCurrencyInput(dom.inputLowMonth.value);
    state.currentBuffer = parseCurrencyInput(dom.inputCurrentBuffer.value);
    state.taxAndCostRate = parseFloat(dom.sliderTaxRate.value) || 0;
    state.commissionRate = parseFloat(dom.sliderCommissionRate.value) || 0;
  };

  const syncInputsFromState = () => {
    dom.inputGrossIncome.value = formatForInput(state.grossIncome);
    dom.inputEssentialCost.value = formatForInput(state.essentialCost);
    dom.inputTargetSalary.value = formatForInput(state.targetSalary);
    dom.inputLowMonth.value = formatForInput(state.lowMonthAverage);
    dom.inputCurrentBuffer.value = formatForInput(state.currentBuffer);

    dom.sliderTaxRate.value = state.taxAndCostRate;
    dom.taxRateLabel.textContent = `${state.taxAndCostRate}%`;

    dom.sliderCommissionRate.value = state.commissionRate;
    dom.commissionRateLabel.textContent = `${state.commissionRate.toFixed(1)}%`;

    updateStrategyUI(state.strategyProfile);
  };

  // ==================== CONTROLE DO SELETOR DE ESTRATÉGIA ====================
  const strategyDescriptions = {
    shield: {
      badge: 'Blindagem Rápida',
      desc: 'Blindagem Rápida: 75% para Colchão de Sazonalidade, 10% para Lazer livre e 15% para Patrimônio / 13º.'
    },
    balanced: {
      badge: 'Equilibrado (Recomendado)',
      desc: 'Equilibrado: 60% para Colchão de Sazonalidade, 15% para Lazer livre e 25% para Construção de Patrimônio / 13º.'
    },
    wealth: {
      badge: 'Foco em Patrimônio',
      desc: 'Patrimônio / 13º: 40% para Colchão de Sazonalidade, 20% para Lazer livre e 40% para Investimentos e Patrimônio.'
    }
  };

  const updateStrategyUI = (activeStrategy) => {
    state.strategyProfile = activeStrategy;
    dom.strategyBtns.forEach((btn) => {
      const isSelected = btn.getAttribute('data-strategy') === activeStrategy;
      if (isSelected) {
        btn.className =
          'strategy-btn py-2 px-1 text-center rounded-lg transition-all bg-white text-emerald-950 font-bold shadow-xs border border-slate-200';
      } else {
        btn.className =
          'strategy-btn py-2 px-1 text-center rounded-lg transition-all text-slate-600 hover:text-slate-900 font-medium';
      }
    });

    const info = strategyDescriptions[activeStrategy] || strategyDescriptions.balanced;
    dom.strategyBadgeText.textContent = info.badge;
    dom.strategyDesc.textContent = info.desc;
  };

  // ==================== INTEGRAÇÃO COM BACKEND (API /api/calculate) ====================
  const calculateFinancials = async () => {
    try {
      syncStateFromInputs();
      saveStateToStorage();

      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.statusText}`);
      }

      const json = await response.json();
      if (json.success && json.data) {
        currentCalculationData = json.data;
        renderDashboard(json.data);
      }
    } catch (err) {
      console.error('Falha ao processar cálculo financeiro:', err);
    }
  };

  const debouncedCalculate = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      calculateFinancials();
    }, 150);
  };

  // ==================== ATUALIZAÇÃO DO DASHBOARD ====================
  const renderDashboard = (data) => {
    const { financials, status, allocationBreakdown } = data;

    // 1. Atualização do Banner de Status
    if (status.code === 'surplus') {
      // Mês de Alta (Verde Claro FinTech)
      dom.statusBanner.className =
        'p-5 rounded-2xl border transition-all duration-300 bg-emerald-50 border-emerald-200 text-emerald-950';
      dom.statusIconContainer.className =
        'w-10 h-10 rounded-xl bg-emerald-400 text-emerald-950 flex items-center justify-center shrink-0 shadow-xs';
      dom.statusBadge.className =
        'text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900';
      dom.statusBadge.textContent = 'Saldo Positivo';
      dom.statusIcon.innerHTML =
        '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />';
    } else if (status.code === 'drawdown') {
      // Mês Abaixo da Meta (Âmbar suave)
      dom.statusBanner.className =
        'p-5 rounded-2xl border transition-all duration-300 bg-amber-50 border-amber-200 text-amber-950';
      dom.statusIconContainer.className =
        'w-10 h-10 rounded-xl bg-amber-300 text-amber-950 flex items-center justify-center shrink-0 shadow-xs';
      dom.statusBadge.className =
        'text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900';
      dom.statusBadge.textContent = 'Ativação do Colchão';
      dom.statusIcon.innerHTML =
        '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />';
    } else {
      // Mês Crítico (Abaixo do essencial - Tom âmbar destacado)
      dom.statusBanner.className =
        'p-5 rounded-2xl border transition-all duration-300 bg-amber-100/70 border-amber-300 text-amber-950';
      dom.statusIconContainer.className =
        'w-10 h-10 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center shrink-0 shadow-xs';
      dom.statusBadge.className =
        'text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-300 text-amber-900';
      dom.statusBadge.textContent = 'Modo Contenção';
      dom.statusIcon.innerHTML =
        '<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />';
    }

    dom.statusTitle.textContent = status.label;
    dom.statusDescText.textContent = status.description;

    // 2. Cards Principais (Grid 2x2)
    dom.cardGuaranteedSalary.textContent = formatBRL(financials.guaranteedSalary);
    dom.cardTaxProvision.textContent = formatBRL(financials.taxDeducted);

    // Card 3: Aporte vs Resgate
    if (financials.bufferAllocation > 0) {
      dom.cardBufferActionBadge.textContent = '3. Aporte no Colchão';
      dom.cardBufferActionBadge.className = 'text-xs font-semibold uppercase tracking-wider text-emerald-700';
      dom.cardBufferActionIcon.className = 'w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs';
      dom.cardBufferActionIcon.textContent = '🛡️';
      dom.cardBufferActionSub.textContent = 'Blindagem de Sazonalidade';
      dom.cardBufferValue.className = 'text-xl sm:text-2xl font-extrabold text-emerald-800 mt-1';
      dom.cardBufferValue.textContent = `+${formatBRL(financials.bufferAllocation)}`;
      dom.cardBufferNote.textContent = 'Destinado para sustentar meses fracos futuros.';
    } else if (financials.bufferWithdrawal > 0) {
      dom.cardBufferActionBadge.textContent = '3. Resgate do Colchão';
      dom.cardBufferActionBadge.className = 'text-xs font-semibold uppercase tracking-wider text-amber-800';
      dom.cardBufferActionIcon.className = 'w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center text-xs';
      dom.cardBufferActionIcon.textContent = '⚠️';
      dom.cardBufferActionSub.textContent = 'Complementação de Salário';
      dom.cardBufferValue.className = 'text-xl sm:text-2xl font-extrabold text-amber-800 mt-1';
      dom.cardBufferValue.textContent = `-${formatBRL(financials.bufferWithdrawal)}`;
      dom.cardBufferNote.textContent = 'Resgate este valor do colchão para manter seu salário estável.';
    } else {
      dom.cardBufferActionBadge.textContent = '3. Colchão Neutro';
      dom.cardBufferActionBadge.className = 'text-xs font-semibold uppercase tracking-wider text-slate-500';
      dom.cardBufferActionIcon.className = 'w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-xs';
      dom.cardBufferActionIcon.textContent = '⚖️';
      dom.cardBufferActionSub.textContent = 'Meta Atingida com Precisão';
      dom.cardBufferValue.className = 'text-xl sm:text-2xl font-extrabold text-slate-700 mt-1';
      dom.cardBufferValue.textContent = formatBRL(0);
      dom.cardBufferNote.textContent = 'Sem aporte ou resgate necessário este mês.';
    }

    // Card 4: Lazer Livre + Patrimônio
    const totalBonus = financials.rewardBonus + financials.wealthBonus;
    dom.cardFreeBonus.textContent = formatBRL(totalBonus);
    dom.subRewardValue.textContent = formatBRL(financials.rewardBonus);
    dom.subWealthValue.textContent = formatBRL(financials.wealthBonus);

    // 3. Barra de Alocação Visual (100% Empilhada)
    dom.totalIncomeHeader.textContent = `Total: ${formatBRL(state.grossIncome)}`;

    const { tax, salary, buffer, reward, wealth } = allocationBreakdown;
    dom.barTax.style.width = `${tax.percentage}%`;
    dom.barSalary.style.width = `${salary.percentage}%`;
    dom.barBuffer.style.width = `${buffer.percentage}%`;
    dom.barReward.style.width = `${reward.percentage}%`;
    dom.barWealth.style.width = `${wealth.percentage}%`;

    dom.legendTaxPct.textContent = `${tax.percentage}%`;
    dom.legendSalaryPct.textContent = `${salary.percentage}%`;
    dom.legendBufferPct.textContent = `${buffer.percentage}%`;
    dom.legendRewardPct.textContent = `${reward.percentage}%`;
    dom.legendWealthPct.textContent = `${wealth.percentage}%`;

    // 4. Termômetro de Blindagem & Sobrevivência
    const progress = Math.min(100, Math.max(0, financials.shieldProgress));
    dom.shieldProgressBar.style.width = `${progress}%`;
    dom.bufferGoalProgressText.textContent = `${progress}%`;
    dom.bufferGoalComparison.textContent = `${formatBRL(financials.newBufferTotal)} / ${formatBRL(financials.idealBufferGoal)}`;

    dom.metricMonthsLow.textContent = financials.monthsSurvivingLow.toFixed(1);
    dom.metricMonthsZero.textContent = financials.monthsZeroSales.toFixed(1);
    dom.metricSalesVolume.textContent = formatBRL(financials.salesVolumeNeeded);
  };

  // ==================== EXPORTAÇÃO PARA WHATSAPP ====================
  const exportToWhatsApp = async () => {
    if (!currentCalculationData) return;

    const { financials, inputs, status } = currentCalculationData;

    let bufferLine = '';
    if (financials.bufferAllocation > 0) {
      bufferLine = `🛡️ *Aporte no Colchão:* +${formatBRL(financials.bufferAllocation)}`;
    } else if (financials.bufferWithdrawal > 0) {
      bufferLine = `⚠️ *Resgate do Colchão:* -${formatBRL(financials.bufferWithdrawal)}`;
    } else {
      bufferLine = `🛡️ *Movimentação Colchão:* R$ 0,00 (Neutro)`;
    }

    const textToCopy = `📊 *PLANO FINANCEIRO MENSAL | ComissãoEstável*
━━━━━━━━━━━━━━━━━━━━━━
💰 *Renda Bruta do Mês:* ${formatBRL(inputs.grossIncome)}
🧾 *Provisão Impostos/Custos (${inputs.taxAndCostRate}%):* ${formatBRL(financials.taxDeducted)}
💵 *Renda Líquida Real:* ${formatBRL(financials.netIncome)}

🎯 *Salário Estável (Retirada PF):* ${formatBRL(financials.guaranteedSalary)}
${bufferLine}
🎉 *Lazer Livre (Sem Culpa):* ${formatBRL(financials.rewardBonus)}
📈 *Patrimônio / 13º:* ${formatBRL(financials.wealthBonus)}

━━━━━━━━━━━━━━━━━━━━━━
🛡️ *SAÚDE DO COLCHÃO DE SAZONALIDADE:*
• Saldo Projetado: ${formatBRL(financials.newBufferTotal)} (${financials.shieldProgress}% da meta de 6 meses)
• Autonomia em Meses Fracos: ${financials.monthsSurvivingLow} meses
• Sobrevivência com Venda Zero: ${financials.monthsZeroSales} meses
• Meta Comercial do Mês: ${formatBRL(financials.salesVolumeNeeded)} em vendas (${inputs.commissionRate}% de comissão)

_Diagnóstico: ${status.label}_
_Gerado pelo ComissãoEstável - Nivelamento de Renda Inteligente_`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback clássico
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      // Feedback visual no botão
      const originalText = dom.btnExportText.textContent;
      dom.btnExportText.textContent = '✓ Plano Copiado para o WhatsApp!';
      dom.btnExportWhatsApp.classList.add('bg-emerald-50', 'border-emerald-400', 'text-emerald-900');

      setTimeout(() => {
        dom.btnExportText.textContent = originalText;
        dom.btnExportWhatsApp.classList.remove('bg-emerald-50', 'border-emerald-400', 'text-emerald-900');
      }, 2500);
    } catch (err) {
      console.error('Falha ao copiar texto:', err);
      alert('Não foi possível copiar automaticamente. Por favor, tente novamente.');
    }
  };

  // ==================== ARTIGOS EDUCATIVOS E MODAL ====================
  const loadArticles = async () => {
    try {
      const response = await fetch('/api/articles');
      if (!response.ok) throw new Error('Falha ao carregar artigos');
      const json = await response.json();
      if (json.success && json.data) {
        articlesData = json.data;
        renderArticlesList(articlesData);
      }
    } catch (err) {
      console.error('Erro ao buscar artigos:', err);
      dom.articlesGrid.innerHTML = `
        <div class="col-span-2 p-6 text-center text-sm text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
          Não foi possível carregar os artigos educativos no momento. Verifique se o servidor está ativo.
        </div>
      `;
    }
  };

  const renderArticlesList = (articles) => {
    dom.articlesGrid.innerHTML = articles
      .map(
        (article) => `
        <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                ${article.category}
              </span>
              <span class="text-[11px] text-slate-400">
                ${article.readTime}
              </span>
            </div>
            <h3 class="text-base sm:text-lg font-bold text-slate-900 group-hover:text-emerald-800 transition-colors leading-snug">
              ${article.title}
            </h3>
            <p class="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
              ${article.summary}
            </p>
          </div>

          <div class="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
            <span class="text-[11px] font-medium text-slate-400">
              ${article.badge || 'Artigo Prático'}
            </span>
            <button type="button" data-article-id="${article.id}" class="btn-open-article text-xs font-semibold text-emerald-800 group-hover:text-emerald-950 inline-flex items-center gap-1">
              Ler artigo <span class="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </div>
      `
      )
      .join('');

    // Adiciona ouvintes para abrir o modal
    document.querySelectorAll('.btn-open-article').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-article-id');
        openArticleModal(id);
      });
    });
  };

  const openArticleModal = (articleId) => {
    const article = articlesData.find((a) => a.id === articleId);
    if (!article) return;

    dom.modalCategory.textContent = article.category;
    dom.modalReadTime.textContent = article.readTime;
    dom.modalTitle.textContent = article.title;

    // Renderiza seções formatadas
    let contentHtml = '';

    if (article.sections && Array.isArray(article.sections)) {
      article.sections.forEach((section) => {
        contentHtml += `<div class="space-y-2.5">`;
        if (section.heading) {
          contentHtml += `<h4 class="text-sm font-bold text-slate-900">${section.heading}</h4>`;
        }
        if (section.paragraphs && Array.isArray(section.paragraphs)) {
          section.paragraphs.forEach((p) => {
            contentHtml += `<p class="text-xs text-slate-600 leading-relaxed">${p}</p>`;
          });
        }
        if (section.tips && Array.isArray(section.tips)) {
          contentHtml += `<ul class="space-y-2 my-2">`;
          section.tips.forEach((tip) => {
            contentHtml += `
              <li class="flex items-start gap-2 text-xs text-slate-700 bg-emerald-50/70 border border-emerald-200/80 p-2.5 rounded-xl">
                <span class="text-emerald-600 font-bold shrink-0">✓</span>
                <span>${tip}</span>
              </li>
            `;
          });
          contentHtml += `</ul>`;
        }
        contentHtml += `</div>`;
      });
    }

    dom.modalContent.innerHTML = contentHtml;
    dom.articleModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  };

  const closeArticleModal = () => {
    dom.articleModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  };

  // ==================== PRESETS E BOTÕES DE AÇÃO ====================
  const applyPreset = (presetValues) => {
    state = { ...state, ...presetValues };
    syncInputsFromState();
    calculateFinancials();
  };

  // ==================== BINDING DE EVENTOS ====================
  const setupEventListeners = () => {
    // Inputs monetários - formatar amigavelmente no blur e calcular no input
    const currencyInputs = [
      dom.inputGrossIncome,
      dom.inputEssentialCost,
      dom.inputTargetSalary,
      dom.inputLowMonth,
      dom.inputCurrentBuffer
    ];

    currencyInputs.forEach((input) => {
      input.addEventListener('input', () => {
        debouncedCalculate();
      });

      input.addEventListener('blur', () => {
        const parsed = parseCurrencyInput(input.value);
        input.value = formatForInput(parsed);
        debouncedCalculate();
      });

      // Seleciona tudo ao focar para facilitar edição
      input.addEventListener('focus', () => {
        input.select();
      });
    });

    // Sliders
    dom.sliderTaxRate.addEventListener('input', (e) => {
      dom.taxRateLabel.textContent = `${e.target.value}%`;
      debouncedCalculate();
    });

    dom.sliderCommissionRate.addEventListener('input', (e) => {
      dom.commissionRateLabel.textContent = `${parseFloat(e.target.value).toFixed(1)}%`;
      debouncedCalculate();
    });

    // Botões de Estratégia
    dom.strategyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const strategy = btn.getAttribute('data-strategy');
        updateStrategyUI(strategy);
        debouncedCalculate();
      });
    });

    // Presets
    dom.btnPresetRecord.addEventListener('click', () => {
      applyPreset({
        grossIncome: 26000,
        essentialCost: 4200,
        targetSalary: 7500,
        lowMonthAverage: 3000,
        currentBuffer: 15000,
        taxAndCostRate: 6,
        commissionRate: 5,
        strategyProfile: 'balanced'
      });
    });

    dom.btnPresetLow.addEventListener('click', () => {
      applyPreset({
        grossIncome: 3500,
        essentialCost: 4200,
        targetSalary: 7500,
        lowMonthAverage: 3000,
        currentBuffer: 15000,
        taxAndCostRate: 6,
        commissionRate: 5,
        strategyProfile: 'balanced'
      });
    });

    dom.btnReset.addEventListener('click', () => {
      if (confirm('Deseja restaurar os parâmetros padrão da calculadora?')) {
        state = { ...defaultState };
        syncInputsFromState();
        calculateFinancials();
      }
    });

    // Exportação WhatsApp
    dom.btnExportWhatsApp.addEventListener('click', exportToWhatsApp);

    // Modal
    dom.modalCloseBtn.addEventListener('click', closeArticleModal);
    dom.modalFooterCloseBtn.addEventListener('click', closeArticleModal);
    dom.modalBackdrop.addEventListener('click', closeArticleModal);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dom.articleModal.classList.contains('hidden')) {
        closeArticleModal();
      }
    });
  };

  // ==================== INICIALIZAÇÃO ====================
  const init = () => {
    loadStoredState();
    syncInputsFromState();
    setupEventListeners();
    calculateFinancials();
    loadArticles();
  };

  // Iniciar após carregar o DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
