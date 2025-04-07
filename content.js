// Bilibili Live Gift Helper - Content Script
// This script runs on the Bilibili live income page and enhances its functionality

(function() {
  // Main configuration
  const config = {
    targetUrl: 'https://link.bilibili.com/p/center/index#/live-data/gift-list',
    selectors: {
      dateInput: '.el-input__inner[placeholder="选择日期"]',
      searchButton: '.bl-button--primary',
      giftTable: '.simple-grid',
      totalIncome: '.income',
      giftDesc: '.gift-desc',
      categorySelector: '.item.type .selector .current',
      giftTypeSelector: '.item.gift .selector .current',
      nicknameInput: '.link-input',
      pageTitle: '.page-title',
      sectionBlock: '.section-block.with-radius.with-padding'
    },
    cssPrefix: 'bli-gift-helper'
  };

  // State management
  const state = {
    isActive: false,
    isProcessing: false,
    startDate: null,
    endDate: null,
    currentDate: null,
    totalDays: 0,
    currentDay: 0,
    category: null,
    giftType: null,
    nickname: null,
    allData: [],
    datePickerInstance: null,
    cardContainer: null
  };

  // Initialize the extension
  function init() {
    // Only run on the target page
    if (!window.location.href.includes('/live-data/gift-list')) {
      return;
    }

    console.log('Bilibili Live Gift Helper: Initializing...');
    
    // Create and inject UI components
    injectStyles();
    createHelperCard();
    createDateRangePicker();
    createControlPanel();
    
    // Setup event listeners
    setupEventListeners();
    
    state.isActive = true;
    console.log('Bilibili Live Gift Helper: Ready');
  }
  
  // Create the helper card container
  function createHelperCard() {
    const card = document.createElement('div');
    card.className = `${config.cssPrefix}-card`;
    
    const cardHeader = document.createElement('div');
    cardHeader.className = `${config.cssPrefix}-card-header`;
    cardHeader.innerHTML = '<h3>bilibili直播收益助手</h3>';
    
    const cardBody = document.createElement('div');
    cardBody.className = `${config.cssPrefix}-card-body`;
    
    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    
    // Find the page title element
    const pageTitle = document.querySelector(config.selectors.pageTitle);
    if (pageTitle) {
      // Insert the card after the page title
      pageTitle.parentNode.insertBefore(card, pageTitle.nextSibling);
    } else {
      // Fallback: append to the section block
      const sectionBlock = document.querySelector(config.selectors.sectionBlock);
      if (sectionBlock) {
        sectionBlock.parentNode.insertBefore(card, sectionBlock);
      }
    }
    
    // Store the card body for later use
    state.cardContainer = cardBody;
  }

  // Create the date range picker UI component
  function createDateRangePicker() {
    if (!state.cardContainer) return;
    
    const datePickerContainer = document.createElement('div');
    datePickerContainer.className = `${config.cssPrefix}-date-range`;
    
    // Create date range UI with fetch button in the same line
    datePickerContainer.innerHTML = `
      <span class="hint">时间范围</span>
      <div class="date-range-selector">
        <input type="date" class="start-date" placeholder="开始日期">
        <span class="date-separator">至</span>
        <input type="date" class="end-date" placeholder="结束日期">
        <button class="fetch-btn">获取时间段数据</button>
      </div>
    `;
    
    // Add to the card body
    state.cardContainer.appendChild(datePickerContainer);
    
    // Setup event listeners for date inputs
    const startDateInput = datePickerContainer.querySelector('.start-date');
    const endDateInput = datePickerContainer.querySelector('.end-date');
    
    startDateInput.addEventListener('change', (e) => {
      // Use year, month, day to create date object to avoid timezone issues
      const dateArr = e.target.value.split('-').map(Number);
      state.startDate = new Date(dateArr[0], dateArr[1] - 1, dateArr[2]);
    });
    
    endDateInput.addEventListener('change', (e) => {
      // Use year, month, day to create date object to avoid timezone issues
      const dateArr = e.target.value.split('-').map(Number);
      state.endDate = new Date(dateArr[0], dateArr[1] - 1, dateArr[2]);
    });
    
    // Setup fetch button event listener
    const fetchButton = datePickerContainer.querySelector('.fetch-btn');
    if (fetchButton) {
      fetchButton.addEventListener('click', startDataFetching);
    }
  }
  
  // Create the control panel with progress display
  function createControlPanel() {
    if (!state.cardContainer) return;
    
    const controlPanel = document.createElement('div');
    controlPanel.className = `${config.cssPrefix}-control-panel`;
    
    // Create control panel with improved progress display and cancel button
    controlPanel.innerHTML = `
      <div class="progress-container" style="display: none;">
        <div class="progress-info">
          <div class="progress-status">
            <span class="current-day">0</span>/<span class="total-days">0</span> 天
            <span class="current-date"></span>
            <span class="percentage">0%</span>
          </div>
          <button class="cancel-btn">取消</button>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar"></div>
        </div>
      </div>
      <div class="action-buttons" style="display: none;">
        <button class="export-csv-btn">导出CSV</button>
        <button class="open-analysis-btn">数据分析</button>
      </div>
    `;
    
    // Add to the card body
    state.cardContainer.appendChild(controlPanel);
    
    // Add event listener for the cancel button
    const cancelButton = controlPanel.querySelector('.cancel-btn');
    if (cancelButton) {
      cancelButton.addEventListener('click', cancelDataFetching);
    }
    
    // Add event listeners for action buttons
    const exportCsvButton = controlPanel.querySelector('.export-csv-btn');
    if (exportCsvButton) {
      exportCsvButton.addEventListener('click', exportToCsv);
    }
    
    const openAnalysisButton = controlPanel.querySelector('.open-analysis-btn');
    if (openAnalysisButton) {
      openAnalysisButton.addEventListener('click', openAnalysisPage);
    }
  }
  
  // Function to cancel ongoing data fetching
  function cancelDataFetching() {
    if (!state.isProcessing) return;
    
    state.isProcessing = false;
    
    // Reset UI
    const fetchButton = document.querySelector(`.${config.cssPrefix}-date-range .fetch-btn`);
    if (fetchButton) {
      fetchButton.disabled = false;
      fetchButton.textContent = '获取时间段数据';
    }
    
    const progressContainer = document.querySelector(`.${config.cssPrefix}-control-panel .progress-container`);
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }
    
    console.log('Data fetching cancelled');
  }
  
  // Function to simulate a click on the date picker to show the popup
  function simulateDatePickerClick(callback) {
    console.log('Attempting to simulate click on date picker');
    
    // Find the date picker input element
    const dateInput = document.querySelector(config.selectors.dateInput);
    if (!dateInput) {
      console.error('Date input element not found');
      // Continue with the normal flow if we can't find the date picker
      if (callback) callback();
      return;
    }
    
    // Simulate click event on the date picker
    try {
      // Create and dispatch events
      dateInput.focus();
      
      // Simulate mousedown event
      const mousedownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      dateInput.dispatchEvent(mousedownEvent);
      
      // Simulate click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      dateInput.dispatchEvent(clickEvent);
      
      console.log('Date picker click simulated successfully');
      
      // Wait for the popup to appear and initialize
      setTimeout(() => {
        // Simulate a click again to close the popup
        dateInput.dispatchEvent(clickEvent);
        
        console.log('Date picker popup should have appeared and closed');
        
        // Give some time for any popup-related processing to complete
        setTimeout(() => {
          if (callback) callback();
        }, 300);
      }, 300);
    } catch (error) {
      console.error('Error simulating date picker click:', error);
      // Continue with the normal flow if the simulation fails
      if (callback) callback();
    }
  }
  
  // Setup event listeners for the plugin UI
  function setupEventListeners() {
    // All event listeners are now set directly in the component creation functions
  }
  
  // Start the data fetching process
  function startDataFetching() {
    // Validate inputs
    if (!state.startDate || !state.endDate) {
      alert('请选择开始日期和结束日期');
      return;
    }
    
    if (state.startDate > state.endDate) {
      alert('结束日期必须大于等于开始日期');
      return;
    }
    
    if (state.isProcessing) {
      alert('正在处理数据，请稍候');
      return;
    }
    
    // Get filter values
    state.category = document.querySelector(config.selectors.categorySelector).textContent.trim();
    state.giftType = document.querySelector(config.selectors.giftTypeSelector).textContent.trim();
    state.nickname = document.querySelector(config.selectors.nicknameInput).value.trim();
    
    // Calculate total days
    const oneDay = 24 * 60 * 60 * 1000;
    state.totalDays = Math.round(Math.abs((state.endDate - state.startDate) / oneDay)) + 1;
    state.currentDay = 0;
    // Ensure precise date retrieval, starting from user-selected start date
    const year = state.startDate.getFullYear();
    const month = state.startDate.getMonth();
    const day = state.startDate.getDate();
    state.currentDate = new Date(year, month, day);
    state.allData = [];
    
    // Update UI
    const progressContainer = document.querySelector(`.${config.cssPrefix}-control-panel .progress-container`);
    progressContainer.style.display = 'block';
    
    document.querySelector(`.${config.cssPrefix}-control-panel .total-days`).textContent = state.totalDays;
    document.querySelector(`.${config.cssPrefix}-control-panel .current-day`).textContent = 0;
    document.querySelector(`.${config.cssPrefix}-control-panel .percentage`).textContent = '0%';
    document.querySelector(`.${config.cssPrefix}-control-panel .progress-bar`).style.width = '0%';
    document.querySelector(`.${config.cssPrefix}-control-panel .current-date`).textContent = 
      `准备获取: ${state.currentDate.getFullYear()}-${(state.currentDate.getMonth() + 1).toString().padStart(2, '0')}-${state.currentDate.getDate().toString().padStart(2, '0')}`;
    
    // Disable fetch button
    const fetchButton = document.querySelector(`.${config.cssPrefix}-date-range .fetch-btn`);
    fetchButton.disabled = true;
    fetchButton.textContent = '正在获取数据...';
    
    // Start processing
    state.isProcessing = true;
    
    // First simulate a click on the date picker to ensure the popup shows up once
    console.log('Initializing date picker by simulating click before starting data fetch');
    simulateDatePickerClick(() => {
      // Start data fetching after the date picker has been initialized
      console.log(`Starting data fetch: ${state.currentDate.toISOString().split('T')[0]}`);
      fetchNextDay();
    });
  }
  
  // Fetch data for the next day in sequence
  function fetchNextDay() {
    // Check if fetching was cancelled
    if (!state.isProcessing) {
      return;
    }
    
    if (state.currentDate > state.endDate) {
      finishDataFetching();
      return;
    }
    
    // Increment day counter
    state.currentDay++;
    const progress = (state.currentDay / state.totalDays) * 100;
    
    // Update progress UI with percentage
    document.querySelector(`.${config.cssPrefix}-control-panel .current-day`).textContent = state.currentDay;
    document.querySelector(`.${config.cssPrefix}-control-panel .percentage`).textContent = `${Math.round(progress)}%`;
    document.querySelector(`.${config.cssPrefix}-control-panel .progress-bar`).style.width = `${progress}%`;
    document.querySelector(`.${config.cssPrefix}-control-panel .current-date`).textContent = 
      `正在获取: ${state.currentDate.getFullYear()}-${(state.currentDate.getMonth() + 1).toString().padStart(2, '0')}-${state.currentDate.getDate().toString().padStart(2, '0')}`;
    
    // Output current date for debugging
    console.log(`处理日期: ${state.currentDate.toISOString().split('T')[0]}`);
    
    // Set date in original date picker
    setDateAndSearch(state.currentDate);
  }
  
  // Set date in the original date picker and trigger search
  function setDateAndSearch(date) {
    // Check if fetching was cancelled
    if (!state.isProcessing) {
      return;
    }
    
    // Format date for input
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    
    // Find the date picker input - original Bilibili date selector
    const dateInput = document.querySelector(config.selectors.dateInput);
    if (!dateInput) {
      console.error('Original date input not found');
      moveToNextDay();
      return;
    }
    
    // Use internal Vue.js date picker if possible
    if (dateInput.__vue__) {
      dateInput.__vue__.value = formattedDate;
      dateInput.__vue__.$emit('input', formattedDate);
    } else {
      // Fallback: try to set input value and dispatch events
      dateInput.value = formattedDate;
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Wait for date picker to update
    setTimeout(() => {
      // Check again if fetching was cancelled
      if (!state.isProcessing) {
        return;
      }
      
      // Enter nickname if any
      if (state.nickname) {
        const nicknameInput = document.querySelector(config.selectors.nicknameInput);
        if (nicknameInput) {
          nicknameInput.value = state.nickname;
          nicknameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      
      // Click search button
      const searchButton = document.querySelector(config.selectors.searchButton);
      if (searchButton) {
        searchButton.click();
        
        // Wait for data to load
        setTimeout(extractAndProcessData, 1500);
      } else {
        console.error('Search button not found');
        moveToNextDay();
      }
    }, 500);
  }
  
  // Extract data from current page and move to next day
  function extractAndProcessData() {
    // Check if fetching was cancelled
    if (!state.isProcessing) {
      return;
    }
    
    try {
      // Check if table exists
      const tableElement = document.querySelector(config.selectors.giftTable);
      if (!tableElement) {
        console.warn('Table not found, moving to next day');
        moveToNextDay();
        return;
      }
      
      // Get total income for the day
      let totalDayIncome = 0;
      const totalIncomeElement = document.querySelector(config.selectors.totalIncome);
      if (totalIncomeElement) {
        totalDayIncome = parseInt(totalIncomeElement.textContent, 10) || 0;
      }
      
      // Extract table rows
      const rows = tableElement.querySelectorAll('tbody tr');
      const dayData = [];
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td .cell');
        if (cells.length >= 7) {
          const rowData = {
            date: new Date(state.currentDate),
            formattedDate: `${state.currentDate.getFullYear()}-${(state.currentDate.getMonth() + 1).toString().padStart(2, '0')}-${state.currentDate.getDate().toString().padStart(2, '0')}`,
            role: cells[0].textContent.trim(),
            roomId: cells[1].textContent.trim(),
            sender: cells[2].textContent.trim(),
            timestamp: cells[3].textContent.trim(),
            giftName: cells[4].textContent.trim(),
            quantity: parseInt(cells[5].textContent.trim(), 10),
            goldHamster: parseInt(cells[6].textContent.trim(), 10)
          };
          
          dayData.push(rowData);
        }
      });
      
      // Add day data to total
      state.allData = state.allData.concat(dayData);
      console.log(`Extracted ${dayData.length} records for ${state.currentDate.toISOString().split('T')[0]}`);
      
      // Go to next page if available
      const nextPageButton = document.querySelector('.page-button-next');
      if (nextPageButton && nextPageButton.style.display !== 'none') {
        nextPageButton.click();
        setTimeout(extractAndProcessData, 1500);
      } else {
        moveToNextDay();
      }
    } catch (error) {
      console.error('Error extracting data:', error);
      moveToNextDay();
    }
  }
  
  // Move to the next day in the date range
  function moveToNextDay() {
    // Check if fetching was cancelled
    if (!state.isProcessing) {
      return;
    }
    
    // Create new date object and increment
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const day = state.currentDate.getDate() + 1; // Add one day
    state.currentDate = new Date(year, month, day);
    
    // Output next date to be processed, for debugging
    console.log(`下一个日期: ${state.currentDate.toISOString().split('T')[0]}`);
    
    // Process next day or finish
    setTimeout(fetchNextDay, 500);
  }
  
  // Finish the data fetching process
  function finishDataFetching() {
    state.isProcessing = false;
    
    // Update UI
    const fetchButton = document.querySelector(`.${config.cssPrefix}-date-range .fetch-btn`);
    fetchButton.disabled = false;
    fetchButton.textContent = '获取时间段数据';
    
    document.querySelector(`.${config.cssPrefix}-control-panel .current-date`).textContent = '数据获取完成';
    document.querySelector(`.${config.cssPrefix}-control-panel .action-buttons`).style.display = 'block';
    
    console.log(`Data fetching completed. Total records: ${state.allData.length}`);
    
    // Save to localStorage for later use
    saveDataToStorage();
  }
  
  // Save fetched data to localStorage
  function saveDataToStorage() {
    try {
      const dataToSave = {
        fetchDate: new Date().toISOString(),
        startDate: state.startDate.toISOString(),
        endDate: state.endDate.toISOString(),
        category: state.category,
        giftType: state.giftType,
        nickname: state.nickname,
        records: state.allData
      };
      
      localStorage.setItem('blivegifthelper_data', JSON.stringify(dataToSave));
      console.log('Data saved to localStorage');
    } catch (error) {
      console.error('Error saving data to localStorage:', error);
    }
  }
  
  // Export data to CSV file
  function exportToCsv() {
    if (!state.allData || state.allData.length === 0) {
      alert('没有数据可导出');
      return;
    }
    
    try {
      // Prepare CSV header
      const header = ['日期', '收礼身份', '直播间ID', '送礼用户', '收礼时间', '礼物名称', '数量', '金仓鼠数'];
      
      // Prepare CSV rows
      const rows = state.allData.map(item => [
        item.formattedDate,
        item.role,
        item.roomId,
        item.sender,
        item.timestamp,
        item.giftName,
        item.quantity,
        item.goldHamster
      ]);
      
      // Join all rows
      const csvContent = [
        header.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Create Blob with BOM for Chinese characters support
      const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([BOM, csvContent], { type: 'text/csv;charset=utf-8' });
      
      // Generate filename
      const startDateStr = state.startDate.toISOString().split('T')[0];
      const endDateStr = state.endDate.toISOString().split('T')[0];
      const filename = `bilibili_gifts_${startDateStr}_to_${endDateStr}.csv`;
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      console.log('CSV exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('导出CSV时出错，请查看控制台');
    }
  }
  
  // Generate statistics for analysis tab
  function generateStatistics() {
    if (!state.allData || state.allData.length === 0) return;
    
    // Total income
    const totalIncome = state.allData.reduce((sum, item) => sum + item.goldHamster, 0);
    document.querySelector(`.${config.cssPrefix}-stat-card.total-income .stat-value`).textContent = totalIncome.toLocaleString();
    document.querySelector(`.${config.cssPrefix}-stat-card.total-income .stat-description`).textContent = 
      `约 ¥${(totalIncome / 1000).toFixed(2)}`; // Corrected: 1000 gold hamsters = 1 RMB
    
    // Total gifts
    const totalGifts = state.allData.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueGifts = new Set(state.allData.map(item => item.giftName)).size;
    document.querySelector(`.${config.cssPrefix}-stat-card.total-gifts .stat-value`).textContent = totalGifts.toLocaleString();
    document.querySelector(`.${config.cssPrefix}-stat-card.total-gifts .stat-description`).textContent = 
      `共${uniqueGifts}种不同礼物`;
    
    // Contributor ranking
    const contributors = {};
    state.allData.forEach(item => {
      if (!contributors[item.sender]) {
        contributors[item.sender] = { gifts: 0, hamster: 0 };
      }
      contributors[item.sender].gifts += item.quantity;
      contributors[item.sender].hamster += item.goldHamster;
    });
    
    const contributorRanking = Object.keys(contributors).map(sender => ({
      sender,
      gifts: contributors[sender].gifts,
      hamster: contributors[sender].hamster,
      percentage: (contributors[sender].hamster / totalIncome * 100).toFixed(2)
    }))
    .sort((a, b) => b.hamster - a.hamster)
    .slice(0, 10);
    
    const contributorTable = document.querySelector('#contributor-ranking tbody');
    contributorTable.innerHTML = '';
    
    contributorRanking.forEach((contributor, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${contributor.sender}</td>
        <td>${contributor.gifts}</td>
        <td>${contributor.hamster}</td>
        <td>${contributor.percentage}%</td>
      `;
      contributorTable.appendChild(tr);
    });
    
    // Active days ranking
    const activeDays = {};
    state.allData.forEach(item => {
      if (!activeDays[item.sender]) {
        activeDays[item.sender] = { days: new Set(), hamster: 0 };
      }
      activeDays[item.sender].days.add(item.formattedDate);
      activeDays[item.sender].hamster += item.goldHamster;
    });
    
    const activeDaysRanking = Object.keys(activeDays).map(sender => ({
      sender,
      days: activeDays[sender].days.size,
      hamster: activeDays[sender].hamster
    }))
    .sort((a, b) => b.days - a.days || b.hamster - a.hamster)
    .slice(0, 10);
    
    const activeDaysTable = document.querySelector('#active-days-ranking tbody');
    activeDaysTable.innerHTML = '';
    
    activeDaysRanking.forEach((user, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${user.sender}</td>
        <td>${user.days}</td>
        <td>${user.hamster}</td>
      `;
      activeDaysTable.appendChild(tr);
    });
    
    // Gift type statistics
    const giftTypes = {};
    state.allData.forEach(item => {
      if (!giftTypes[item.giftName]) {
        giftTypes[item.giftName] = { count: 0, quantity: 0, hamster: 0 };
      }
      giftTypes[item.giftName].count++;
      giftTypes[item.giftName].quantity += item.quantity;
      giftTypes[item.giftName].hamster += item.goldHamster;
    });
    
    const giftTypeStats = Object.keys(giftTypes).map(giftName => ({
      giftName,
      count: giftTypes[giftName].count,
      quantity: giftTypes[giftName].quantity,
      hamster: giftTypes[giftName].hamster,
      percentage: (giftTypes[giftName].hamster / totalIncome * 100).toFixed(2)
    }))
    .sort((a, b) => b.hamster - a.hamster);
    
    const giftTypeTable = document.querySelector('#gift-type-stats tbody');
    giftTypeTable.innerHTML = '';
    
    giftTypeStats.forEach(gift => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${gift.giftName}</td>
        <td>${gift.count}</td>
        <td>${gift.quantity}</td>
        <td>${gift.hamster}</td>
        <td>${gift.percentage}%</td>
      `;
      giftTypeTable.appendChild(tr);
    });
  }
  
  // Open data analysis modal
  function openAnalysisPage() {
    if (!state.allData || state.allData.length === 0) {
      alert('没有数据可分析');
      return;
    }
    
    // Create modal if it doesn't exist
    createAnalysisModal();
    
    // Show modal
    const modal = document.querySelector(`.${config.cssPrefix}-modal`);
    if (modal) {
      modal.style.display = 'flex';
      fillTableData();
      generateStatistics();
    }
  }
  
  // Create the analysis modal
  function createAnalysisModal() {
    // Check if modal already exists
    if (document.querySelector(`.${config.cssPrefix}-modal`)) {
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = `${config.cssPrefix}-modal`;
    
    const startDateStr = state.startDate.toISOString().split('T')[0];
    const endDateStr = state.endDate.toISOString().split('T')[0];
    
    modal.innerHTML = `
      <div class="${config.cssPrefix}-modal-content">
        <div class="${config.cssPrefix}-modal-header">
          <h2>数据分析 (${startDateStr} 至 ${endDateStr})</h2>
          <button class="close-modal">×</button>
        </div>
        
        <div class="${config.cssPrefix}-tab-container">
          <div class="${config.cssPrefix}-tab active" data-tab="table">表格数据</div>
          <div class="${config.cssPrefix}-tab" data-tab="stats">统计报告</div>
        </div>
        
        <div class="${config.cssPrefix}-tab-content active" data-tab-content="table">
          <div class="${config.cssPrefix}-table-filters">
            <div class="${config.cssPrefix}-filter-header">
              <p>过滤条件</p>
              <button class="reset-filters">重置过滤器</button>
            </div>
            <div class="${config.cssPrefix}-filter-list"></div>
          </div>
          <div class="${config.cssPrefix}-data-table-container">
            <table class="${config.cssPrefix}-data-table">
              <thead>
                <tr>
                  <th data-sort="date">日期 <span class="sort-icon">↕</span></th>
                  <th data-sort="role">收礼身份 <span class="sort-icon">↕</span></th>
                  <th data-sort="roomId">直播间ID <span class="sort-icon">↕</span></th>
                  <th data-sort="sender">送礼用户 <span class="sort-icon">↕</span></th>
                  <th data-sort="timestamp">收礼时间 <span class="sort-icon">↕</span></th>
                  <th data-sort="giftName">礼物名称 <span class="sort-icon">↕</span></th>
                  <th data-sort="quantity">数量 <span class="sort-icon">↕</span></th>
                  <th data-sort="goldHamster">金仓鼠数 <span class="sort-icon">↕</span></th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
        
        <div class="${config.cssPrefix}-tab-content" data-tab-content="stats">
          <div class="${config.cssPrefix}-stats-container">
            <div class="${config.cssPrefix}-stat-card total-income">
              <h3>总收入金仓鼠</h3>
              <div class="stat-value">0</div>
              <div class="stat-description">约 ¥0.00</div>
            </div>
            
            <div class="${config.cssPrefix}-stat-card total-gifts">
              <h3>总礼物数量</h3>
              <div class="stat-value">0</div>
              <div class="stat-description">共0种不同礼物</div>
            </div>
            
            <h3 class="${config.cssPrefix}-stat-title">贡献排行前10</h3>
            <div class="${config.cssPrefix}-stat-table-container">
              <table class="${config.cssPrefix}-stat-table" id="contributor-ranking">
                <thead>
                  <tr>
                    <th>排名</th>
                    <th>用户昵称</th>
                    <th>礼物数量</th>
                    <th>金仓鼠数</th>
                    <th>占比</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
            
            <h3 class="${config.cssPrefix}-stat-title">活跃天数排行前10</h3>
            <div class="${config.cssPrefix}-stat-table-container">
              <table class="${config.cssPrefix}-stat-table" id="active-days-ranking">
                <thead>
                  <tr>
                    <th>排名</th>
                    <th>用户昵称</th>
                    <th>活跃天数</th>
                    <th>总金仓鼠数</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
            
            <h3 class="${config.cssPrefix}-stat-title">礼物类型统计</h3>
            <div class="${config.cssPrefix}-stat-table-container">
              <table class="${config.cssPrefix}-stat-table" id="gift-type-stats">
                <thead>
                  <tr>
                    <th>礼物名称</th>
                    <th>收到次数</th>
                    <th>总数量</th>
                    <th>总金仓鼠数</th>
                    <th>占比</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeButton = modal.querySelector('.close-modal');
    closeButton.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    // Tab switching
    const tabs = modal.querySelectorAll(`.${config.cssPrefix}-tab`);
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active content
        const contents = modal.querySelectorAll(`.${config.cssPrefix}-tab-content`);
        contents.forEach(content => {
          content.classList.remove('active');
          if (content.getAttribute('data-tab-content') === tabName) {
            content.classList.add('active');
          }
        });
      });
    });
    
    // Reset filters
    const resetFiltersButton = modal.querySelector('.reset-filters');
    resetFiltersButton.addEventListener('click', resetFilters);
    
    // Table sorting
    const tableHeaders = modal.querySelectorAll(`.${config.cssPrefix}-data-table th[data-sort]`);
    tableHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const sortBy = header.getAttribute('data-sort');
        sortTable(sortBy);
      });
    });
    
    // Create column filters
    createColumnFilters();
  }
  
  // Fill table with data
  function fillTableData() {
    const tableBody = document.querySelector(`.${config.cssPrefix}-data-table tbody`);
    if (!tableBody || !state.allData) return;
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Apply filters if any
    let dataToShow = [...state.allData];
    
    // Sort data if needed
    const sortField = tableBody.getAttribute('data-sort-field') || 'date';
    const sortDirection = tableBody.getAttribute('data-sort-direction') || 'asc';
    
    dataToShow = sortData(dataToShow, sortField, sortDirection);
    
    // Create rows
    dataToShow.forEach(item => {
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>${item.formattedDate}</td>
        <td>${item.role}</td>
        <td>${item.roomId}</td>
        <td>${item.sender}</td>
        <td>${item.timestamp}</td>
        <td>${item.giftName}</td>
        <td>${item.quantity}</td>
        <td>${item.goldHamster}</td>
      `;
      
      tableBody.appendChild(tr);
    });
  }
  
  // Sort table data
  function sortTable(sortBy) {
    const tableBody = document.querySelector(`.${config.cssPrefix}-data-table tbody`);
    const currentSortField = tableBody.getAttribute('data-sort-field');
    let currentSortDirection = tableBody.getAttribute('data-sort-direction') || 'asc';
    
    // Toggle direction if clicking the same column
    if (currentSortField === sortBy) {
      currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      currentSortDirection = 'asc';
    }
    
    // Update table attributes
    tableBody.setAttribute('data-sort-field', sortBy);
    tableBody.setAttribute('data-sort-direction', currentSortDirection);
    
    // Update header UI
    const headers = document.querySelectorAll(`.${config.cssPrefix}-data-table th[data-sort]`);
    headers.forEach(header => {
      const headerSortBy = header.getAttribute('data-sort');
      const sortIcon = header.querySelector('.sort-icon');
      
      if (headerSortBy === sortBy) {
        sortIcon.textContent = currentSortDirection === 'asc' ? '↑' : '↓';
      } else {
        sortIcon.textContent = '↕';
      }
    });
    
    // Re-fill table
    fillTableData();
  }
  
  // Sort data array by field
  function sortData(data, field, direction) {
    return [...data].sort((a, b) => {
      let valueA, valueB;
      
      if (field === 'date') {
        valueA = new Date(a.date).getTime();
        valueB = new Date(b.date).getTime();
      } else if (field === 'quantity' || field === 'goldHamster') {
        valueA = a[field];
        valueB = b[field];
      } else {
        valueA = String(a[field]).toLowerCase();
        valueB = String(b[field]).toLowerCase();
      }
      
      if (valueA < valueB) {
        return direction === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
  
  // Create column filters
  function createColumnFilters() {
    const filterContainer = document.querySelector(`.${config.cssPrefix}-filter-list`);
    if (!filterContainer || !state.allData || state.allData.length === 0) return;
    
    // Clear existing filters
    filterContainer.innerHTML = '';
    
    // Define filterable columns
    const filterableColumns = [
      { field: 'role', label: '收礼身份' },
      { field: 'sender', label: '送礼用户' },
      { field: 'giftName', label: '礼物名称' }
    ];
    
    // Create filters for each column
    filterableColumns.forEach(column => {
      // Get unique values
      const values = [...new Set(state.allData.map(item => item[column.field]))];
      
      const filterDiv = document.createElement('div');
      filterDiv.className = `${config.cssPrefix}-filter`;
      
      filterDiv.innerHTML = `
        <div class="${config.cssPrefix}-filter-header">
          <span>${column.label}</span>
          <div class="${config.cssPrefix}-filter-actions">
            <button class="select-all" data-field="${column.field}">全选</button>
            <button class="deselect-all" data-field="${column.field}">取消全选</button>
          </div>
        </div>
        <div class="${config.cssPrefix}-filter-options" data-field="${column.field}">
          ${values.map(value => `
            <label>
              <input type="checkbox" data-field="${column.field}" data-value="${value}" checked>
              ${value}
            </label>
          `).join('')}
        </div>
      `;
      
      filterContainer.appendChild(filterDiv);
      
      // Add event listeners
      const selectAllBtn = filterDiv.querySelector('.select-all');
      const deselectAllBtn = filterDiv.querySelector('.deselect-all');
      
      selectAllBtn.addEventListener('click', () => {
        const checkboxes = filterDiv.querySelectorAll(`input[data-field="${column.field}"]`);
        checkboxes.forEach(cb => cb.checked = true);
        applyFilters();
      });
      
      deselectAllBtn.addEventListener('click', () => {
        const checkboxes = filterDiv.querySelectorAll(`input[data-field="${column.field}"]`);
        checkboxes.forEach(cb => cb.checked = false);
        applyFilters();
      });
      
      // Add change listener to checkboxes
      const checkboxes = filterDiv.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(cb => {
        cb.addEventListener('change', applyFilters);
      });
    });
  }
  
  // Apply filters to the table
  function applyFilters() {
    const filterableColumns = ['role', 'sender', 'giftName'];
    const filters = {};
    
    // Collect active filters
    filterableColumns.forEach(field => {
      const checkboxes = document.querySelectorAll(`input[data-field="${field}"]:checked`);
      if (checkboxes.length > 0) {
        filters[field] = [...checkboxes].map(cb => cb.getAttribute('data-value'));
      }
    });
    
    // Filter data
    let filteredData = [...state.allData];
    
    Object.keys(filters).forEach(field => {
      if (filters[field] && filters[field].length > 0) {
        filteredData = filteredData.filter(item => filters[field].includes(item[field]));
      }
    });
    
    // Update table with filtered data
    const tableBody = document.querySelector(`.${config.cssPrefix}-data-table tbody`);
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    filteredData.forEach(item => {
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>${item.formattedDate}</td>
        <td>${item.role}</td>
        <td>${item.roomId}</td>
        <td>${item.sender}</td>
        <td>${item.timestamp}</td>
        <td>${item.giftName}</td>
        <td>${item.quantity}</td>
        <td>${item.goldHamster}</td>
      `;
      
      tableBody.appendChild(tr);
    });
  }
  
  // Reset all filters
  function resetFilters() {
    const checkboxes = document.querySelectorAll(`.${config.cssPrefix}-filter input[type="checkbox"]`);
    checkboxes.forEach(cb => cb.checked = true);
    applyFilters();
  }

  // Inject required CSS styles
  function injectStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      /* Styles are now loaded from external CSS file */
    `;
    
    document.head.appendChild(styleElement);
  }

  // Wait for page to be fully loaded
  window.addEventListener('load', () => {
    // Wait a bit more for dynamic content
    setTimeout(init, 1500);
  });

  // Check if already loaded
  if (document.readyState === 'complete') {
    setTimeout(init, 1500);
  }
})(); 