/**
 * ComissãoEstável - Lógica Frontend
 * Controle de Estado, Reatividade (Debounce), LocalStorage, Formatação e Modal
 */

(function () {
  'use strict';

  // ==================== ESTADO DA APLICAÇÃO ====================
  const STORAGE_KEY = 'comissao_estavel_state_v2';

  const defaultState = {
    grossIncome: 0,
    essentialCost: 0,
    targetSalary: 0,
    lowMonthAverage: 0,
    currentBuffer: 0,
    taxAndCostRate: 6,
    commissionRate: 5,
    strategyProfile: 'balanced' // 'shield' | 'balanced' | 'wealth'
  };

  let state = { ...defaultState };
  let currentCalculationData = null;
  let articlesData = [];
  let debounceTimer = null;

  // Estado de Navegação Passo a Passo (Tela Sobreposta / Wizard Modal)
  let currentStep = 1;
  const TOTAL_STEPS = 4;

  const stepMeta = {
    1: { shortLabel: 'Renda & Custos do Mês', focusId: 'modalInputGrossIncome' },
    2: { shortLabel: 'Padrão de Vida & Salário', focusId: 'modalInputEssentialCost' },
    3: { shortLabel: 'Sazonalidade & Colchão', focusId: 'modalInputLowMonth' },
    4: { shortLabel: 'Estratégia & Revisão Final', focusId: null }
  };

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
   * Se for zero ou vazio, retorna string vazia para exibir o placeholder explicativo
   */
  const formatForInput = (num) => {
    const val = Number(num);
    if (!val || val === 0) return '';
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

    // Wizard (Tela Sobreposta Passo a Passo)
    simulatorWizardModal: document.getElementById('simulatorWizardModal'),
    wizardModalBackdrop: document.getElementById('wizardModalBackdrop'),
    wizardModalCloseBtn: document.getElementById('wizardModalCloseBtn'),
    btnHeroSimulate: document.getElementById('btnHeroSimulate'),
    btnOpenWizardHeader: document.getElementById('btnOpenWizardHeader'),
    btnOpenWizardCard: document.getElementById('btnOpenWizardCard'),

    modalInputGrossIncome: document.getElementById('modalInputGrossIncome'),
    modalInputEssentialCost: document.getElementById('modalInputEssentialCost'),
    modalInputTargetSalary: document.getElementById('modalInputTargetSalary'),
    modalInputLowMonth: document.getElementById('modalInputLowMonth'),
    modalInputCurrentBuffer: document.getElementById('modalInputCurrentBuffer'),
    modalSliderTaxRate: document.getElementById('modalSliderTaxRate'),
    modalTaxRateLabel: document.getElementById('modalTaxRateLabel'),
    modalSliderCommissionRate: document.getElementById('modalSliderCommissionRate'),
    modalCommissionRateLabel: document.getElementById('modalCommissionRateLabel'),
    modalStrategyBadgeText: document.getElementById('modalStrategyBadgeText'),
    modalStrategyDesc: document.getElementById('modalStrategyDesc'),

    wizardStepCounterBadge: document.getElementById('wizardStepCounterBadge'),
    wizardStepShortLabel: document.getElementById('wizardStepShortLabel'),
    wizardProgressBar: document.getElementById('wizardProgressBar'),
    wizardTabBtns: document.querySelectorAll('.wizard-tab-btn'),
    wizardStepPanels: document.querySelectorAll('.wizard-step-panel'),
    btnPrevStep: document.getElementById('btnPrevStep'),
    btnNextStep: document.getElementById('btnNextStep'),
    btnNextStepText: document.getElementById('btnNextStepText'),
    btnNextStepIcon: document.getElementById('btnNextStepIcon'),

    // Previews Contextuais por Passo
    step1NetPreview: document.getElementById('step1NetPreview'),
    step1TaxPreview: document.getElementById('step1TaxPreview'),
    step2FeedbackBox: document.getElementById('step2FeedbackBox'),
    step2FeedbackTitle: document.getElementById('step2FeedbackTitle'),
    step2MarginPreview: document.getElementById('step2MarginPreview'),
    step2StatusBadge: document.getElementById('step2StatusBadge'),
    btnSuggestTargetSalary: document.getElementById('btnSuggestTargetSalary'),
    step3GapPreview: document.getElementById('step3GapPreview'),
    step3IdealBufferPreview: document.getElementById('step3IdealBufferPreview'),
    summaryStep1Text: document.getElementById('summaryStep1Text'),
    summaryStep2Text: document.getElementById('summaryStep2Text'),
    summaryStep3Text: document.getElementById('summaryStep3Text'),

    // Blocos da Coluna Direita
    diagCardSalary: document.getElementById('diagCardSalary'),
    diagCardTax: document.getElementById('diagCardTax'),
    diagCardBuffer: document.getElementById('diagCardBuffer'),
    diagCardBonus: document.getElementById('diagCardBonus'),
    diagAllocationBox: document.getElementById('diagAllocationBox'),
    diagShieldBox: document.getElementById('diagShieldBox'),

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

  // ==================== SINCRONIZAÇÃO UI <-> ESTADO ====================
  const syncStateFromMainInputs = () => {
    state.grossIncome = parseCurrencyInput(dom.inputGrossIncome.value);
    state.essentialCost = parseCurrencyInput(dom.inputEssentialCost.value);
    state.targetSalary = parseCurrencyInput(dom.inputTargetSalary.value);
    state.lowMonthAverage = parseCurrencyInput(dom.inputLowMonth.value);
    state.currentBuffer = parseCurrencyInput(dom.inputCurrentBuffer.value);
    state.taxAndCostRate = parseFloat(dom.sliderTaxRate.value) || 0;
    state.commissionRate = parseFloat(dom.sliderCommissionRate.value) || 0;
  };

  const syncStateFromModalInputs = () => {
    if (!dom.modalInputGrossIncome) return;
    state.grossIncome = parseCurrencyInput(dom.modalInputGrossIncome.value);
    state.essentialCost = parseCurrencyInput(dom.modalInputEssentialCost.value);
    state.targetSalary = parseCurrencyInput(dom.modalInputTargetSalary.value);
    state.lowMonthAverage = parseCurrencyInput(dom.modalInputLowMonth.value);
    state.currentBuffer = parseCurrencyInput(dom.modalInputCurrentBuffer.value);
    state.taxAndCostRate = parseFloat(dom.modalSliderTaxRate.value) || 0;
    state.commissionRate = parseFloat(dom.modalSliderCommissionRate.value) || 0;
  };

  const syncInputsFromState = () => {
    // Inputs da página principal
    dom.inputGrossIncome.value = formatForInput(state.grossIncome);
    dom.inputEssentialCost.value = formatForInput(state.essentialCost);
    dom.inputTargetSalary.value = formatForInput(state.targetSalary);
    dom.inputLowMonth.value = formatForInput(state.lowMonthAverage);
    dom.inputCurrentBuffer.value = formatForInput(state.currentBuffer);

    dom.sliderTaxRate.value = state.taxAndCostRate;
    dom.taxRateLabel.textContent = `${state.taxAndCostRate}%`;

    dom.sliderCommissionRate.value = state.commissionRate;
    dom.commissionRateLabel.textContent = `${state.commissionRate.toFixed(1)}%`;

    // Inputs da Tela Sobreposta (Wizard Modal)
    if (dom.modalInputGrossIncome) {
      dom.modalInputGrossIncome.value = formatForInput(state.grossIncome);
      dom.modalInputEssentialCost.value = formatForInput(state.essentialCost);
      dom.modalInputTargetSalary.value = formatForInput(state.targetSalary);
      dom.modalInputLowMonth.value = formatForInput(state.lowMonthAverage);
      dom.modalInputCurrentBuffer.value = formatForInput(state.currentBuffer);

      dom.modalSliderTaxRate.value = state.taxAndCostRate;
      dom.modalTaxRateLabel.textContent = `${state.taxAndCostRate}%`;

      dom.modalSliderCommissionRate.value = state.commissionRate;
      dom.modalCommissionRateLabel.textContent = `${state.commissionRate.toFixed(1)}%`;
    }

    updateStrategyUI(state.strategyProfile);
    updateStepContextPreviews();
  };

  // ==================== CONTROLE DO WIZARD MODAL (TELA SOBREPOSTA PASSO A PASSO) ====================
  const isStepCompleted = (stepNum) => {
    if (stepNum === 1) return state.grossIncome > 0;
    if (stepNum === 2) return state.essentialCost > 0 || state.targetSalary > 0;
    if (stepNum === 3) return state.lowMonthAverage > 0 || state.currentBuffer > 0;
    if (stepNum === 4) return state.grossIncome > 0 && state.targetSalary > 0;
    return false;
  };

  const updateStepContextPreviews = () => {
    // Fase 1: Prévia de Renda Líquida e Imposto
    const taxDeducted = state.grossIncome * (state.taxAndCostRate / 100);
    const netIncome = Math.max(0, state.grossIncome - taxDeducted);
    if (dom.step1NetPreview) dom.step1NetPreview.textContent = formatBRL(netIncome);
    if (dom.step1TaxPreview) dom.step1TaxPreview.textContent = formatBRL(taxDeducted);

    // Fase 2: Margem de Conforto entre Salário Estável e Custo Essencial
    if (dom.step2FeedbackBox) {
      if (state.essentialCost === 0 && state.targetSalary === 0) {
        dom.step2FeedbackBox.className =
          'p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3';
        dom.step2FeedbackTitle.className = 'text-[10px] font-bold uppercase tracking-wider text-slate-500 block';
        dom.step2MarginPreview.className = 'text-sm font-extrabold text-slate-800';
        dom.step2MarginPreview.textContent = 'Preencha para ver sua margem';
        dom.step2StatusBadge.className =
          'text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700';
        dom.step2StatusBadge.textContent = 'Aguardando';
      } else if (state.targetSalary >= state.essentialCost && state.targetSalary > 0) {
        const margin = state.targetSalary - state.essentialCost;
        dom.step2FeedbackBox.className =
          'p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-3';
        dom.step2FeedbackTitle.className = 'text-[10px] font-bold uppercase tracking-wider text-emerald-800 block';
        dom.step2MarginPreview.className = 'text-sm font-extrabold text-emerald-950';
        dom.step2MarginPreview.textContent = `+${formatBRL(margin)} acima do essencial`;
        dom.step2StatusBadge.className =
          'text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900';
        dom.step2StatusBadge.textContent = 'Saudável';
      } else {
        const deficit = state.essentialCost - state.targetSalary;
        dom.step2FeedbackBox.className =
          'p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3';
        dom.step2FeedbackTitle.className = 'text-[10px] font-bold uppercase tracking-wider text-amber-800 block';
        dom.step2MarginPreview.className = 'text-sm font-extrabold text-amber-950';
        dom.step2MarginPreview.textContent = `Faltam ${formatBRL(deficit)} p/ cobrir o essencial`;
        dom.step2StatusBadge.className =
          'text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900';
        dom.step2StatusBadge.textContent = 'Atenção';
      }
    }

    // Fase 3: Déficit Mensal em Meses Fracos e Meta de 6 Meses
    const monthlyGap = Math.max(state.targetSalary - state.lowMonthAverage, state.essentialCost * 0.5, 0);
    const idealBufferGoal = monthlyGap * 6;
    if (dom.step3GapPreview) dom.step3GapPreview.textContent = `${formatBRL(monthlyGap)} / mês`;
    if (dom.step3IdealBufferPreview) dom.step3IdealBufferPreview.textContent = formatBRL(idealBufferGoal);

    // Fase 4: Resumo Compacto
    if (dom.summaryStep1Text) {
      dom.summaryStep1Text.textContent = `${formatBRL(state.grossIncome)} (${state.taxAndCostRate}% imp. | ${state.commissionRate}% com.)`;
    }
    if (dom.summaryStep2Text) {
      dom.summaryStep2Text.textContent = `Essencial: ${formatBRL(state.essentialCost)} • Salário: ${formatBRL(state.targetSalary)}`;
    }
    if (dom.summaryStep3Text) {
      dom.summaryStep3Text.textContent = `Baixa: ${formatBRL(state.lowMonthAverage)} • Colchão: ${formatBRL(state.currentBuffer)}`;
    }

    // Atualiza checks visuais nas abas do Stepper
    dom.wizardTabBtns.forEach((btn) => {
      const stepNum = parseInt(btn.getAttribute('data-goto-step'), 10);
      const checkEl = btn.querySelector('.step-check');
      if (checkEl) {
        if (isStepCompleted(stepNum)) {
          checkEl.classList.remove('hidden');
        } else {
          checkEl.classList.add('hidden');
        }
      }
    });
  };

  const renderWizardUI = (shouldFocus = false) => {
    if (!dom.wizardStepCounterBadge) return;

    const meta = stepMeta[currentStep] || stepMeta[1];
    dom.wizardStepCounterBadge.textContent = `Fase ${currentStep} de ${TOTAL_STEPS}`;
    dom.wizardStepShortLabel.textContent = meta.shortLabel;
    dom.wizardProgressBar.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;

    // Atualiza aparência das 4 abas do Stepper
    dom.wizardTabBtns.forEach((btn) => {
      const stepNum = parseInt(btn.getAttribute('data-goto-step'), 10);
      const numBadge = btn.querySelector('.step-num');
      const labelSpan = btn.querySelector('span:last-child');
      const completed = isStepCompleted(stepNum);

      if (stepNum === currentStep) {
        btn.className =
          'wizard-tab-btn group flex flex-col items-start p-2 rounded-xl border border-emerald-400 bg-emerald-50/80 text-left transition-all shadow-2xs cursor-pointer';
        if (numBadge) {
          numBadge.className =
            'step-num w-5 h-5 rounded-full bg-emerald-400 text-emerald-950 text-[10px] font-extrabold flex items-center justify-center';
        }
        if (labelSpan) {
          labelSpan.className = 'text-[11px] font-bold text-slate-900 truncate w-full';
        }
      } else if (completed) {
        btn.className =
          'wizard-tab-btn group flex flex-col items-start p-2 rounded-xl border border-emerald-200/80 bg-emerald-50/30 hover:bg-emerald-50/60 text-left transition-all cursor-pointer';
        if (numBadge) {
          numBadge.className =
            'step-num w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center';
        }
        if (labelSpan) {
          labelSpan.className = 'text-[11px] font-semibold text-emerald-950 truncate w-full';
        }
      } else {
        btn.className =
          'wizard-tab-btn group flex flex-col items-start p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-left transition-all cursor-pointer';
        if (numBadge) {
          numBadge.className =
            'step-num w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center';
        }
        if (labelSpan) {
          labelSpan.className = 'text-[11px] font-medium text-slate-600 truncate w-full';
        }
      }
    });

    // Exibe apenas o painel da fase atual
    dom.wizardStepPanels.forEach((panel) => {
      const panelStep = parseInt(panel.getAttribute('data-step-panel'), 10);
      if (panelStep === currentStep) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    // Botões Fase Anterior e Próxima Fase / Finalizar
    dom.btnPrevStep.disabled = currentStep === 1;
    if (currentStep < TOTAL_STEPS) {
      dom.btnNextStepText.textContent = `Avançar para Fase ${currentStep + 1}`;
      dom.btnNextStepIcon.innerHTML =
        '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />';
    } else {
      dom.btnNextStepText.textContent = 'Finalizar e Ver Diagnóstico';
      dom.btnNextStepIcon.innerHTML =
        '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />';
    }

    if (shouldFocus && meta.focusId) {
      const targetInput = document.getElementById(meta.focusId);
      if (targetInput) {
        setTimeout(() => targetInput.focus(), 50);
      }
    }
  };

  const goToStep = (stepNumber, shouldFocus = true) => {
    const clamped = Math.max(1, Math.min(TOTAL_STEPS, stepNumber));
    currentStep = clamped;
    updateStepContextPreviews();
    renderWizardUI(shouldFocus);
  };

  const openWizardModal = (startStep = 1) => {
    if (!dom.simulatorWizardModal) return;
    syncInputsFromState();
    currentStep = startStep;
    renderWizardUI(true);
    dom.simulatorWizardModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  };

  const closeWizardModal = (scrollToResult = false) => {
    if (!dom.simulatorWizardModal) return;
    dom.simulatorWizardModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    syncInputsFromState();
    calculateFinancials();

    if (scrollToResult) {
      const calcSection = document.getElementById('calculadora');
      if (calcSection) {
        calcSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (dom.statusBanner) {
        dom.statusBanner.classList.add('diag-highlight');
        setTimeout(() => {
          dom.statusBanner.classList.remove('diag-highlight');
        }, 1800);
      }
    }
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
          'strategy-btn py-2.5 px-1 text-center rounded-lg transition-all bg-white text-emerald-950 font-bold shadow-xs border border-slate-200 cursor-pointer';
      } else {
        btn.className =
          'strategy-btn py-2.5 px-1 text-center rounded-lg transition-all text-slate-600 hover:text-slate-900 font-medium cursor-pointer';
      }
    });

    const info = strategyDescriptions[activeStrategy] || strategyDescriptions.balanced;
    if (dom.strategyBadgeText) dom.strategyBadgeText.textContent = info.badge;
    if (dom.strategyDesc) dom.strategyDesc.textContent = info.desc;
    if (dom.modalStrategyBadgeText) dom.modalStrategyBadgeText.textContent = info.badge;
    if (dom.modalStrategyDesc) dom.modalStrategyDesc.textContent = info.desc;
  };

  // ==================== CÁLCULO LOCAL DE FALLBACK (OFFLINE / FILE://) ====================
  const computeLocalCalculation = (inputState) => {
    const numGross = Math.max(0, parseFloat(inputState.grossIncome) || 0);
    const numTaxRate = Math.min(35, Math.max(0, parseFloat(inputState.taxAndCostRate) || 0));
    const numEssential = Math.max(0, parseFloat(inputState.essentialCost) || 0);
    const numTarget = Math.max(0, parseFloat(inputState.targetSalary) || 0);
    const numLowMonth = Math.max(0, parseFloat(inputState.lowMonthAverage) || 0);
    const numCurrentBuffer = Math.max(0, parseFloat(inputState.currentBuffer) || 0);
    const numCommissionRate = Math.max(0, parseFloat(inputState.commissionRate) || 0);
    const strategy = ['shield', 'balanced', 'wealth'].includes(inputState.strategyProfile)
      ? inputState.strategyProfile
      : 'balanced';

    const taxDeducted = numGross * (numTaxRate / 100);
    const netIncome = Math.max(0, numGross - taxDeducted);

    let status = 'surplus';
    let statusLabel = '';
    let statusDescription = '';
    let surplus = 0;
    let bufferAllocation = 0;
    let rewardBonus = 0;
    let wealthBonus = 0;
    let bufferWithdrawal = 0;
    const guaranteedSalary = numTarget;

    const strategyRates = {
      shield: { buffer: 0.75, reward: 0.10, wealth: 0.15 },
      balanced: { buffer: 0.60, reward: 0.15, wealth: 0.25 },
      wealth: { buffer: 0.40, reward: 0.20, wealth: 0.40 }
    };
    const currentRates = strategyRates[strategy];

    if (netIncome > numTarget) {
      status = 'surplus';
      statusLabel = 'Mês de Alta: Excedente Gerado';
      statusDescription =
        'Sua renda líquida superou o Salário Estável. O excedente foi particionado para blindar seu futuro, garantir lazer sem culpa e acelerar seu patrimônio.';
      surplus = netIncome - numTarget;
      bufferAllocation = surplus * currentRates.buffer;
      rewardBonus = surplus * currentRates.reward;
      wealthBonus = surplus * currentRates.wealth;
      bufferWithdrawal = 0;
    } else if (netIncome >= numEssential) {
      status = 'drawdown';
      statusLabel = 'Mês Abaixo da Meta: Ativação do Colchão';
      statusDescription =
        'Sua renda deste mês ficou abaixo da sua meta mensal. Resgate a complementação indicada do seu Colchão de Sazonalidade para manter o seu padrão de vida estável.';
      bufferWithdrawal = Math.max(0, numTarget - netIncome);
    } else {
      status = 'critical';
      statusLabel = 'Alerta de Mês Fraco: Modo Contenção';
      statusDescription =
        'A receita líquida não cobriu o custo de sobrevivência essencial. Acione a retirada de socorro do Colchão para cobrir as contas básicas e restrinja gastos supérfluos.';
      bufferWithdrawal = Math.max(0, numTarget - netIncome);
    }

    const newBufferTotal = Math.max(0, numCurrentBuffer + bufferAllocation - bufferWithdrawal);
    const monthlyGap = Math.max(numTarget - numLowMonth, numEssential * 0.5, 1);
    const idealBufferGoal = monthlyGap * 6;
    const shieldProgress =
      idealBufferGoal > 0 ? Math.min(100, Math.round((newBufferTotal / idealBufferGoal) * 100)) : 100;

    const monthsSurvivingLow =
      monthlyGap > 0 ? Math.floor((newBufferTotal / monthlyGap) * 10) / 10 : 0;
    const monthsZeroSales = numEssential > 0 ? parseFloat((newBufferTotal / numEssential).toFixed(1)) : 0;

    const taxFactor = 1 - numTaxRate / 100;
    const neededGrossIncome = taxFactor > 0 ? numTarget / taxFactor : 0;
    const salesVolumeNeeded =
      numCommissionRate > 0 ? neededGrossIncome / (numCommissionRate / 100) : 0;

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

    return {
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
        monthsZeroSales,
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
    };
  };

  const isStaticHost =
    window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');

  // ==================== INTEGRAÇÃO COM BACKEND (API /api/calculate) ====================
  const calculateFinancials = async () => {
    updateStepContextPreviews();
    saveStateToStorage();

    // Se ainda não foram preenchidos valores chave, exibe o estado de espera elegante
    const hasInputs = state.grossIncome > 0 || state.targetSalary > 0 || state.essentialCost > 0;
    if (!hasInputs) {
      currentCalculationData = null;
      renderAwaitingState();
      return;
    }

    if (isStaticHost) {
      const localData = computeLocalCalculation(state);
      currentCalculationData = localData;
      renderDashboard(localData);
      return;
    }

    try {
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
        return;
      }
    } catch (err) {
      // Fallback local imediato caso o servidor Node não esteja ativo
      const localData = computeLocalCalculation(state);
      currentCalculationData = localData;
      renderDashboard(localData);
    }
  };

  const debouncedCalculate = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      calculateFinancials();
    }, 150);
  };

  // ==================== ESTADO DE ESPERA (SEM INPUTS) ====================
  const renderAwaitingState = () => {
    // 1. Banner de Status (Neutro - Aguardando)
    dom.statusBanner.className =
      'p-5 rounded-2xl border transition-all duration-300 bg-slate-100/90 border-slate-200 text-slate-800';
    dom.statusIconContainer.className =
      'w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-xs';
    dom.statusBadge.className =
      'text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700';
    dom.statusBadge.textContent = 'Aguardando Entradas';
    dom.statusIcon.innerHTML =
      '<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />';
    dom.statusTitle.textContent = 'Aguardando Informações do Mês';
    dom.statusDescText.textContent =
      'Preencha seus valores nos campos ao lado (ou selecione "Mês Recorde" / "Mês Fraco" acima) para gerar o diagnóstico de saúde financeira e a divisão inteligente da sua renda.';

    // 2. Cards Principais
    dom.cardGuaranteedSalary.textContent = 'R$ --';
    dom.cardTaxProvision.textContent = 'R$ --';

    dom.cardBufferActionBadge.textContent = '3. Colchão de Sazonalidade';
    dom.cardBufferActionBadge.className = 'text-xs font-semibold uppercase tracking-wider text-slate-400';
    dom.cardBufferActionIcon.className =
      'w-6 h-6 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center text-xs';
    dom.cardBufferActionIcon.textContent = '🛡️';
    dom.cardBufferActionSub.textContent = 'Aguardando valores';
    dom.cardBufferValue.className = 'text-xl sm:text-2xl font-extrabold text-slate-400 mt-1';
    dom.cardBufferValue.textContent = 'R$ --';
    dom.cardBufferNote.textContent = 'Aporte ou resgate calculado após preencher a renda.';

    dom.cardFreeBonus.textContent = 'R$ --';
    dom.subRewardValue.textContent = 'R$ --';
    dom.subWealthValue.textContent = 'R$ --';

    // 3. Barra de Alocação Visual
    dom.totalIncomeHeader.textContent = 'Total: R$ -- (Aguardando dados)';
    dom.barTax.style.width = '0%';
    dom.barSalary.style.width = '0%';
    dom.barBuffer.style.width = '0%';
    dom.barReward.style.width = '0%';
    dom.barWealth.style.width = '0%';
    dom.legendTaxPct.textContent = '0%';
    dom.legendSalaryPct.textContent = '0%';
    dom.legendBufferPct.textContent = '0%';
    dom.legendRewardPct.textContent = '0%';
    dom.legendWealthPct.textContent = '0%';

    // 4. Termômetro
    dom.shieldProgressBar.style.width = '0%';
    dom.bufferGoalProgressText.textContent = '0%';
    dom.bufferGoalComparison.textContent = 'R$ 0,00 / R$ 0,00';
    dom.metricMonthsLow.textContent = '--';
    dom.metricMonthsZero.textContent = '--';
    dom.metricSalesVolume.textContent = 'R$ --';

    // 5. Botão WhatsApp
    dom.btnExportText.textContent = 'Preencha os dados para exportar';
    dom.btnExportWhatsApp.classList.add('opacity-70', 'cursor-not-allowed');
  };

  // ==================== ATUALIZAÇÃO DO DASHBOARD ====================
  const renderDashboard = (data) => {
    const { financials, status, allocationBreakdown } = data;

    // Habilita botão de exportar WhatsApp
    dom.btnExportText.textContent = 'Copiar Plano do Mês para WhatsApp';
    dom.btnExportWhatsApp.classList.remove('opacity-70', 'cursor-not-allowed');

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
    if (!currentCalculationData || state.grossIncome <= 0) {
      alert('Por favor, preencha os valores da calculadora antes de exportar o plano para o WhatsApp.');
      return;
    }

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
  const FALLBACK_ARTICLES = [
    {
      id: 'armadilha-do-mes-recorde',
      title: 'A Armadilha do Mês Recorde: Por que seu melhor mês pode iniciar sua falência',
      category: 'Comportamento Financeiro',
      readTime: '4 min de leitura',
      summary:
        'Quando entra uma bolada de comissão, a euforia costuma elevar o padrão de vida de forma permanente. Entenda como blindar suas finanças contra a ressaca dos meses seguintes.',
      badge: 'Essencial',
      sections: [
        {
          heading: 'A ilusão do novo patamar de renda',
          paragraphs: [
            'Todo profissional que vive de comissão já experimentou aquele mês mágico: três ou quatro grandes negócios fechados na mesma semana, uma premiação extraordinária e um extrato bancário com múltiplos dígitos que parecem nunca mais ter fim.',
            "O perigo mora exatamente na reação psicológica imediata a essa vitória: nosso cérebro subconscientemente normaliza o resultado atípico como o 'novo padrão'. É o gatilho para financiar um carro mais caro, matricular os filhos em uma escola cujo boleto exige um desempenho sobre-humano todo mês ou aumentar o limite do cartão de crédito."
          ]
        },
        {
          heading: 'O efeito chicote da sazonalidade',
          paragraphs: [
            'O comércio e os serviços funcionam em ondas. Um mês de R$ 25.000,00 frequentemente é seguido por um mês de R$ 3.500,00 em períodos de baixa sazonalidade (como início de ano ou períodos pós-feriados). O problema é que boletos fixos não aceitam desculpas sobre o mercado estar lento.',
            'Quando seu custo de vida fixo atinge o teto do seu mês bom, qualquer oscilação negativa força você a recorrer ao cheque especial, cartões rotativos ou empréstimos pessoais para sustentar a pose.'
          ]
        },
        {
          heading: 'Como blindar seu patrimônio na prática',
          tips: [
            'Regra de Ouro do Mês Recorde: O excedente financeiro pertence ao seu futuro e ao seu colchão de segurança, não à concessionária de veículos.',
            'Congele o Custo de Vida Essencial: Seu custo fixo (moradia, alimentação básica, saúde) nunca deve ultrapassar a média líquida dos seus 3 piores meses do ano.',
            'Crie uma recompensa com teto fixo: Destine de 10% a 15% do excedente para comemoração imediata e prazer sem culpa. O restante vai para o Colchão de Sazonalidade.',
            'Espere 30 dias para compras de alto valor: Nunca tome decisões de investimento em bens duráveis na semana em que a comissão caiu.'
          ]
        },
        {
          heading: 'Conclusão e Mentalidade Sênior',
          paragraphs: [
            'Profissionais comissionados de elite não são reconhecidos pelo quanto ganham no seu melhor mês, mas sim pela serenidade e estabilidade com que atravessam os meses mais difíceis sem dever um único centavo a ninguém.'
          ]
        }
      ]
    },
    {
      id: 'conceito-salario-sintetico',
      title: 'O Conceito de Salário Sintético: Como criar um contracheque fixo sendo 100% variável',
      category: 'Engenharia de Renda',
      readTime: '5 min de leitura',
      summary:
        'Descubra o método dos dois bolsos: como criar uma barreira entre o fluxo caótico de comissões e sua conta corrente pessoal para ter previsibilidade absoluta.',
      badge: 'Metodologia',
      sections: [
        {
          heading: 'Por que o modelo tradicional falha para o comissionado',
          paragraphs: [
            'Quem recebe salário com carteira assinada (CLT) tem a previsibilidade como aliada: sabe o dia exato e o valor que cairá na conta. Quem vive de comissões, por outro lado, sofre com a imprevisibilidade de datas e montantes.',
            'O erro clássico de 90% dos corretores e vendedores autônomos é receber o valor da comissão na mesma conta de onde pagam o condomínio, a luz e o supermercado. Isso gera uma falsa percepção de riqueza transitória e ansiedade constante.'
          ]
        },
        {
          heading: 'A estrutura dos dois bolsos (PJ e PF)',
          paragraphs: [
            "O método do Salário Sintético baseia-se em dissociar a velocidade da sua produção comercial do seu consumo pessoal. Você atuará como o 'patrão' de si mesmo através de dois compartimentos distintos:",
            '1. Conta Represadora (Bolso Empresarial / Colchão): Onde caem todas as comissões brutas, de onde saem os impostos e onde fica retido o excedente dos meses fortes.',
            '2. Conta de Consumo Pessoal (PF): Onde você recebe apenas e exclusivamente o seu Salário Estável pré-definido, sempre no mesmo dia do mês (por exemplo, todo dia 5).'
          ]
        },
        {
          heading: 'Passo a passo para definir seu Salário Estável',
          tips: [
            'Mapeie seu Custo Essencial Fixo: Aluguel/Financiamento, contas de consumo, supermercado e convênio médico.',
            'Adicione uma margem de conforto sustentável: Defina um salário que garanta qualidade de vida sem exageros.',
            'Calcule o ponto de equilíbrio: Seu Salário Estável deve ser menor ou igual à média móvel líquida dos seus últimos 12 meses.',
            'Programe a transferência automática: Todo dia 5, transfira exatamente o valor do Salário Estável da sua conta reserva para a sua conta pessoal.'
          ]
        },
        {
          heading: 'O alívio mental da previsibilidade',
          paragraphs: [
            'Quando seu custo de vida é pago pontualmente todo mês por essa reserva programada, você volta a negociar com clientes a partir de uma posição de tranquilidade e autoridade, e nunca mais a partir do desespero por fechar qualquer venda.'
          ]
        }
      ]
    },
    {
      id: 'onde-guardar-colchao-sazonalidade',
      title: 'Onde guardar o Colchão de Sazonalidade: Liquidez Diária vs. Rentabilidade',
      category: 'Investimentos',
      readTime: '4 min de leitura',
      summary:
        'O Colchão de Sazonalidade não serve para deixá-lo milionário, mas sim para impedir que você fique pobre. Saiba escolher os ativos certos com segurança e liquidez imediata.',
      badge: 'Estratégia',
      sections: [
        {
          heading: 'A função biológica do seu colchão financeiro',
          paragraphs: [
            'Muitos profissionais cometem o erro grave de aplicar o dinheiro do colchão de sazonalidade em ações, fundos imobiliários com oscilação de cotas ou em CDBs que travam o resgate por 2 a 3 anos em troca de uma taxa ligeiramente maior.',
            'A missão principal dessa reserva NÃO é enriquecimento por valorização, mas sim disponibilidade instantânea sem perda de principal. Se você precisar do dinheiro em uma terça-feira para cobrir a retirada do mês, o capital deve estar integral e acessível.'
          ]
        },
        {
          heading: 'Os três pilares da alocação do Colchão',
          paragraphs: [
            'Para cumprir seu papel, o veículo de investimento precisa atender a três critérios inegociáveis:',
            '• Liquidez Diária (D+0 ou D+1): Capacidade de resgate imediato sem penalidades ou carências.',
            '• Baixa Volatilidade (Renda Fixa Pós-Fixada): Indexado ao CDI ou taxa Selic, garantindo que o saldo nunca diminua de um dia para o outro.',
            '• Risco de Crédito Mínimo: Emissores de primeira linha (Tesouro Nacional ou grandes instituições financeiras com garantia do FGC).'
          ]
        },
        {
          heading: 'Melhores opções disponíveis no mercado brasileiro',
          tips: [
            'Tesouro Selic: A opção mais segura do país, garantida pelo Governo Federal, com liquidez diária e rentabilidade atrelada à taxa básica de juros.',
            'CDB de Liquidez Diária (100% a 102% do CDI): Disponível em bancos sólidos, com cobertura do Fundo Garantidor de Créditos (FGC) até R$ 250 mil por CPF/CNPJ.',
            'Contas Remuneradas e Fundos DI Simples com Taxa Zero: Excelente praticidade para a movimentação mensal automática sem cobrança de taxa de administração abusiva.',
            'Evite a todo custo: Fundos com carência de 30 dias (D+30), LCIs/LCAs travadas por meses ou renda variável.'
          ]
        },
        {
          heading: 'Separação psicológica',
          paragraphs: [
            'Mantenha esse colchão em uma instituição financeira diferente daquela onde você possui o cartão de crédito do dia a dia. Uma pequena barreira de fricção evita resgates por impulso.'
          ]
        }
      ]
    },
    {
      id: 'separar-imposto-no-mesmo-minuto',
      title: 'PJ, MEI ou Autônomo: Como separar o dinheiro do imposto no mesmo minuto em que a comissão cai',
      category: 'Tributação & Gestão',
      readTime: '4 min de leitura',
      summary:
        'O leão da Receita não negocia. Aprenda a rotina blindada de provisionamento fiscal para nunca mais ser pego de surpresa pelo DAS ou Carnê-Leão.',
      badge: 'Gestão Fiscal',
      sections: [
        {
          heading: 'O dinheiro que entra na sua conta não é todo seu',
          paragraphs: [
            'Uma das maiores causas de endividamento entre corretores de imóveis, representantes comerciais e autônomos é a mistura entre a receita bruta da comissão e o lucro líquido real.',
            'Ao emitir uma nota fiscal de R$ 10.000,00 ou receber uma comissão via RPA (Recibo de Pagamento a Autônomo), uma fração considerável daquele valor já pertence à União, ao Município ou à previdência social. Tratar esse montante como renda disponível é pedir para acumular dívidas tributárias impagáveis.'
          ]
        },
        {
          heading: 'Os diferentes enquadramentos fiscais',
          paragraphs: [
            'Entenda como a mordida tributária atua em cada modalidade:',
            '• Simples Nacional (Anexo III ou V): Alíquotas que variam geralmente entre 6% e 15,5% sobre a receita bruta, pagas mensalmente através da guia DAS.',
            '• Lucro Presumido: Tributação comum para determinadas corretagens e representações, oscilando entre 13,33% e 16,33% somando impostos federais e municipais (ISS).',
            '• Pessoa Física / Carnê-Leão: A opção mais onerosa, onde os rendimentos podem ser tributados em até 27,5% de IRPF mais a contribuição previdenciária (INSS).'
          ]
        },
        {
          heading: 'O protocolo do provisionamento imediato',
          tips: [
            'Identifique sua alíquota efetiva real: Consulte seu contador e descubra exatamente o percentual médio dos seus impostos e custos operacionais de emissão.',
            "Abra uma subconta de custódia tributária: Mantenha um 'cofrinho' ou conta separada exclusivamente denominada 'Reserva Fiscal'.",
            'Ação no mesmo minuto: Se você recebeu R$ 20.000,00 e sua alíquota é de 8%, transfira imediatamente R$ 1.600,00 para a conta de impostos no mesmo instante em que a TED/PIX for creditada.',
            'Nunca conte com a comissão do mês seguinte para pagar o imposto do mês anterior: Essa é a espiral de morte do fluxo de caixa autônomo.'
          ]
        },
        {
          heading: 'Paz de espírito fiscal',
          paragraphs: [
            'Quando chega o dia 20 e vence o boleto do Simples Nacional ou o Carnê-Leão, a sensação de já ter o dinheiro 100% reservado e rendendo CDI diário é um dos maiores alívios que um empreendedor pode desfrutar.'
          ]
        }
      ]
    }
  ];

  const loadArticles = async () => {
    if (isStaticHost) {
      articlesData = FALLBACK_ARTICLES;
      renderArticlesList(articlesData);
      return;
    }

    try {
      const response = await fetch('/api/articles');
      if (!response.ok) throw new Error('Falha ao carregar artigos');
      const json = await response.json();
      if (json.success && json.data) {
        articlesData = json.data;
        renderArticlesList(articlesData);
        return;
      }
    } catch (err) {
      articlesData = FALLBACK_ARTICLES;
      renderArticlesList(articlesData);
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
    renderWizardUI(false);
    calculateFinancials();
  };

  // ==================== BINDING DE EVENTOS ====================
  const setupEventListeners = () => {
    // 1. Inputs monetários da página principal
    const mainCurrencyInputs = [
      dom.inputGrossIncome,
      dom.inputEssentialCost,
      dom.inputTargetSalary,
      dom.inputLowMonth,
      dom.inputCurrentBuffer
    ];

    mainCurrencyInputs.forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => {
        syncStateFromMainInputs();
        debouncedCalculate();
      });

      input.addEventListener('blur', () => {
        syncStateFromMainInputs();
        syncInputsFromState();
        debouncedCalculate();
      });

      input.addEventListener('focus', () => {
        input.select();
      });
    });

    // 2. Inputs monetários da Tela Sobreposta (Wizard Modal)
    const modalCurrencyInputs = [
      dom.modalInputGrossIncome,
      dom.modalInputEssentialCost,
      dom.modalInputTargetSalary,
      dom.modalInputLowMonth,
      dom.modalInputCurrentBuffer
    ];

    modalCurrencyInputs.forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => {
        syncStateFromModalInputs();
        // Atualiza também os inputs da página principal ao fundo
        dom.inputGrossIncome.value = formatForInput(state.grossIncome);
        dom.inputEssentialCost.value = formatForInput(state.essentialCost);
        dom.inputTargetSalary.value = formatForInput(state.targetSalary);
        dom.inputLowMonth.value = formatForInput(state.lowMonthAverage);
        dom.inputCurrentBuffer.value = formatForInput(state.currentBuffer);
        debouncedCalculate();
      });

      input.addEventListener('blur', () => {
        syncStateFromModalInputs();
        syncInputsFromState();
        debouncedCalculate();
      });

      input.addEventListener('focus', () => {
        input.select();
      });

      // Tecla Enter avança de campo ou de fase na Tela Sobreposta
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          syncStateFromModalInputs();
          syncInputsFromState();
          calculateFinancials();

          if (input === dom.modalInputEssentialCost) {
            dom.modalInputTargetSalary.focus();
          } else if (input === dom.modalInputLowMonth) {
            dom.modalInputCurrentBuffer.focus();
          } else if (currentStep < TOTAL_STEPS) {
            goToStep(currentStep + 1, true);
          } else {
            closeWizardModal(true);
          }
        }
      });
    });

    // 3. Botões de Abrir e Fechar a Tela Sobreposta (Simulador Passo a Passo)
    if (dom.btnHeroSimulate) {
      dom.btnHeroSimulate.addEventListener('click', () => openWizardModal(1));
    }
    if (dom.btnOpenWizardHeader) {
      dom.btnOpenWizardHeader.addEventListener('click', () => openWizardModal(1));
    }
    if (dom.btnOpenWizardCard) {
      dom.btnOpenWizardCard.addEventListener('click', () => openWizardModal(1));
    }
    if (dom.wizardModalCloseBtn) {
      dom.wizardModalCloseBtn.addEventListener('click', () => closeWizardModal(false));
    }
    if (dom.wizardModalBackdrop) {
      dom.wizardModalBackdrop.addEventListener('click', () => closeWizardModal(false));
    }

    // 4. Botões de Soma Rápida (+ R$ 1.000, + R$ 5.000, etc.) na Tela Sobreposta
    document.querySelectorAll('.quick-add-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const raw = btn.getAttribute('data-quick-add') || '';
        const [fieldKey, amountStr] = raw.split(':');
        const addAmount = parseFloat(amountStr) || 0;
        if (fieldKey && Object.prototype.hasOwnProperty.call(state, fieldKey) && addAmount > 0) {
          state[fieldKey] = (Number(state[fieldKey]) || 0) + addAmount;
          syncInputsFromState();
          calculateFinancials();
        }
      });
    });

    // 5. Botão Sugerir Salário Estável (+40% sobre Custo Essencial)
    if (dom.btnSuggestTargetSalary) {
      dom.btnSuggestTargetSalary.addEventListener('click', () => {
        const essential = state.essentialCost > 0 ? state.essentialCost : 4000;
        state.essentialCost = essential;
        state.targetSalary = Math.round((essential * 1.4) / 100) * 100;
        syncInputsFromState();
        calculateFinancials();
      });
    }

    // 6. Navegação das Fases da Tela Sobreposta (Stepper + Botões Editar + Anterior/Próximo)
    document.querySelectorAll('[data-goto-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetStep = parseInt(btn.getAttribute('data-goto-step'), 10);
        if (targetStep) {
          goToStep(targetStep, true);
        }
      });
    });

    if (dom.btnPrevStep) {
      dom.btnPrevStep.addEventListener('click', () => {
        if (currentStep > 1) {
          goToStep(currentStep - 1, true);
        }
      });
    }

    if (dom.btnNextStep) {
      dom.btnNextStep.addEventListener('click', () => {
        if (currentStep < TOTAL_STEPS) {
          goToStep(currentStep + 1, true);
        } else {
          // Finaliza a simulação, fecha a tela sobreposta e rola para o diagnóstico completo
          closeWizardModal(true);
        }
      });
    }

    // 7. Sliders (Página Principal + Tela Sobreposta Sincronizados)
    dom.sliderTaxRate.addEventListener('input', (e) => {
      state.taxAndCostRate = parseFloat(e.target.value) || 0;
      dom.taxRateLabel.textContent = `${state.taxAndCostRate}%`;
      if (dom.modalSliderTaxRate) {
        dom.modalSliderTaxRate.value = state.taxAndCostRate;
        dom.modalTaxRateLabel.textContent = `${state.taxAndCostRate}%`;
      }
      debouncedCalculate();
    });

    if (dom.modalSliderTaxRate) {
      dom.modalSliderTaxRate.addEventListener('input', (e) => {
        state.taxAndCostRate = parseFloat(e.target.value) || 0;
        dom.modalTaxRateLabel.textContent = `${state.taxAndCostRate}%`;
        dom.sliderTaxRate.value = state.taxAndCostRate;
        dom.taxRateLabel.textContent = `${state.taxAndCostRate}%`;
        debouncedCalculate();
      });
    }

    dom.sliderCommissionRate.addEventListener('input', (e) => {
      state.commissionRate = parseFloat(e.target.value) || 0;
      dom.commissionRateLabel.textContent = `${state.commissionRate.toFixed(1)}%`;
      if (dom.modalSliderCommissionRate) {
        dom.modalSliderCommissionRate.value = state.commissionRate;
        dom.modalCommissionRateLabel.textContent = `${state.commissionRate.toFixed(1)}%`;
      }
      debouncedCalculate();
    });

    if (dom.modalSliderCommissionRate) {
      dom.modalSliderCommissionRate.addEventListener('input', (e) => {
        state.commissionRate = parseFloat(e.target.value) || 0;
        dom.modalCommissionRateLabel.textContent = `${state.commissionRate.toFixed(1)}%`;
        dom.sliderCommissionRate.value = state.commissionRate;
        dom.commissionRateLabel.textContent = `${state.commissionRate.toFixed(1)}%`;
        debouncedCalculate();
      });
    }

    // 8. Botões de Estratégia
    dom.strategyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const strategy = btn.getAttribute('data-strategy');
        updateStrategyUI(strategy);
        debouncedCalculate();
      });
    });

    // 9. Presets
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
      if (confirm('Deseja limpar todos os campos da calculadora?')) {
        state = { ...defaultState };
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
        syncInputsFromState();
        goToStep(1, false);
        renderAwaitingState();
      }
    });

    // 10. Exportação WhatsApp
    dom.btnExportWhatsApp.addEventListener('click', exportToWhatsApp);

    // 11. Modal de Artigos + Fechamento por Escape
    dom.modalCloseBtn.addEventListener('click', closeArticleModal);
    dom.modalFooterCloseBtn.addEventListener('click', closeArticleModal);
    dom.modalBackdrop.addEventListener('click', closeArticleModal);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dom.simulatorWizardModal && !dom.simulatorWizardModal.classList.contains('hidden')) {
          closeWizardModal(false);
        }
        if (dom.articleModal && !dom.articleModal.classList.contains('hidden')) {
          closeArticleModal();
        }
      }
    });
  };

  // ==================== INICIALIZAÇÃO ====================
  const init = () => {
    loadStoredState();
    syncInputsFromState();
    renderWizardUI(false);
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
