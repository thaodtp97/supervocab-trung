// script.js
const SESSION_SIZE = 50;
let data = [], srsData = [], sessionWords = [], currentIdx = 0;
let user = null, streakCount = 0, lastDate = null;
let answeredCount = 0, correctCount = 0, wrongWords = [];
let sessionStart = null;
const db = firebase.firestore();

// 1) Load dữ liệu & khởi SRS
async function loadData() {
  data = await fetch('words.json').then(r => r.json());
  initSRS();
  user = localStorage.getItem('quiz_user');
  if (user) initQuiz();
}

// 2) SRS: load hoặc khởi mới
function initSRS() {
  const key = 'srs_data';
  const st  = localStorage.getItem(key);
  if (st) srsData = JSON.parse(st);
  else {
    srsData = data.map(w => ({
      hanzi:      w.hanzi,
      pinyin:     w.pinyin,
      meaning:    w.meaning,
      audio:      w.audio,
      rep:        0,
      interval:   1,
      ease:       2.5,
      nextReview: new Date().toISOString()
    }));
    localStorage.setItem(key, JSON.stringify(srsData));
  }
}

// 3) Khởi quiz
function initQuiz() {
  sessionStart  = new Date();
  streakCount   = parseInt(localStorage.getItem(user+'_streak')) || 0;
  lastDate      = localStorage.getItem(user+'_lastDate');
  updateStreak();

  const sk = user+'_session', ik = user+'_idx';
  const ss = localStorage.getItem(sk);
  if (ss) {
    sessionWords = JSON.parse(ss);
    currentIdx   = parseInt(localStorage.getItem(ik))||0;
  } else buildNewSession();

  answeredCount = parseInt(localStorage.getItem(user+'_answered'))||0;
  correctCount  = parseInt(localStorage.getItem(user+'_correct'))||0;
  wrongWords    = [];

  document.getElementById('login-container').style.display='none';
  document.getElementById('quiz-container').style.display='block';
  document.getElementById('welcome').textContent=`Xin chào, ${user}`;
  document.getElementById('show-analytics-btn').style.display='inline-block';

  renderHistory();
  updateHeader();
  showQuestion();
}

// 4) Tạo session mới
function buildNewSession() {
  const now = new Date();
  let due  = srsData.filter(i=>new Date(i.nextReview)<=now);
  if (due.length < SESSION_SIZE) due = srsData.slice();
  sessionWords = shuffle(due).slice(0,SESSION_SIZE);
  localStorage.setItem(user+'_session', JSON.stringify(sessionWords));
  currentIdx=0;
  answeredCount=0; correctCount=0;
  localStorage.setItem(user+'_answered',0);
  localStorage.setItem(user+'_correct',0);
}

// 5) Update streak
function updateStreak() {
  document.getElementById('streak').textContent=`Streak: ${streakCount} ngày`;
}

// 6) Update header
function updateHeader() {
  const qNum = Math.min(currentIdx+1,SESSION_SIZE);
  const acc  = answeredCount?Math.round(correctCount/answeredCount*100):0;
  document.getElementById('session-stats').textContent=
    `Câu ${qNum}/${SESSION_SIZE} (Đúng: ${correctCount}) - Accuracy: ${acc}%`;
}

// 7) Hiển thị câu hỏi
function showQuestion() {
  const optDiv = document.querySelector('.options');
  optDiv.innerHTML='';
  document.getElementById('next-btn').style.display='none';
  document.getElementById('end-session-btn').style.display='none';

  if (currentIdx>=sessionWords.length) return endSession();

  const cur = sessionWords[currentIdx];
  document.getElementById('question').textContent=
    `Chọn chữ Hán có nghĩa: "${cur.meaning}"`;

  const choices = [cur].concat(
    shuffle(srsData.filter(i=>i.hanzi!==cur.hanzi)).slice(0,3)
  );
  shuffle(choices).forEach(item=>{
    const btn=document.createElement('button');
    btn.className='option-btn';
    btn.innerHTML=
      `<div style="font-size:1.5rem">${item.hanzi}</div>`+
      `<div style="font-style:italic;color:#555">${item.pinyin}</div>`;
    btn.onclick=()=>selectAnswer(btn,item);
    optDiv.append(btn);
  });
}

// 8) Xử lý chọn đáp án
function selectAnswer(btn,item) {
  document.querySelectorAll('.option-btn').forEach(b=>b.disabled=true);
  const cur=sessionWords[currentIdx];
  const ok = item.hanzi===cur.hanzi;
  if (ok) correctCount++;
  else {
    btn.classList.add('wrong');
    wrongWords.push(cur.hanzi);
  }

  if (!ok) {
    document.querySelectorAll('.option-btn').forEach(b=>{
      if (b.innerText.includes(cur.hanzi)) b.classList.add('correct');
    });
  } else btn.classList.add('correct');

  // SRS update
  const e = srsData.find(i=>i.hanzi===cur.hanzi);
  if (ok) {
    e.rep++;
    e.interval = e.rep===1?1:
                 e.rep===2?6:
                 Math.ceil(e.interval*e.ease);
    e.nextReview=new Date(Date.now()+e.interval*24*3600*1000).toISOString();
  } else {
    e.rep=0; e.interval=1;
    e.nextReview=new Date(Date.now()+24*3600*1000).toISOString();
  }
  localStorage.setItem('srs_data',JSON.stringify(srsData));

  answeredCount++;
  localStorage.setItem(user+'_answered',answeredCount);
  localStorage.setItem(user+'_correct',correctCount);
  localStorage.setItem(user+'_idx',currentIdx);

  // play audio
  new Audio(item.audio).play();

  updateHeader();
  document.getElementById('next-btn').style.display='inline-block';
  document.getElementById('end-session-btn').style.display='inline-block';
}

// next
document.getElementById('next-btn').onclick=()=>{
  currentIdx++; showQuestion(); updateHeader();
};

// 9) Kết thúc session
function endSession() {
  const end=new Date(), start=sessionStart;
  const diff=end-start;
  const m=Math.floor(diff/60000), s=Math.floor((diff%60000)/1000);
  const dur=`${m}m ${s}s`;

  // streak
  const today=end.toISOString().slice(0,10);
  const yest=new Date(Date.now()-86400000).toISOString().slice(0,10);
  if (lastDate===yest) streakCount++;
  else if (lastDate!==today) streakCount=1;
  lastDate=today;
  localStorage.setItem(user+'_streak',streakCount);
  localStorage.setItem(user+'_lastDate',today);

  // lịch sử local
  const hk=user+'_history';
  const hist=JSON.parse(localStorage.getItem(hk)||'[]');
  hist.push({
    date:today,
    startTime:start.toISOString(),
    endTime:end.toISOString(),
    duration:dur,
    correct:correctCount,
    total:answeredCount,
    pct:answeredCount?Math.round(correctCount/answeredCount*100):0,
    mistakes:wrongWords
  });
  localStorage.setItem(hk,JSON.stringify(hist));

  // Firestore
  db.collection('sessions').add({
    user,
    date:today,
    startTime:start.toISOString(),
    endTime:end.toISOString(),
    duration:dur,
    correct:correctCount,
    total:answeredCount,
    mistakes:wrongWords
  }).catch(console.error);

  // clear session
  localStorage.removeItem(user+'_session');
  localStorage.removeItem(user+'_idx');

  initQuiz();
}

// 10) Render lịch sử
function renderHistory() {
  const hist=JSON.parse(localStorage.getItem(user+'_history')||'[]');
  if (!hist.length) return;
  const tb=document.querySelector('#history-table tbody');
  tb.innerHTML='';
  hist.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=
      `<td>${r.date}</td>`+
      `<td>${r.correct}</td>`+
      `<td>${r.total}</td>`+
      `<td>${r.pct}%</td>`+
      `<td>${(r.mistakes||[]).join(', ')}</td>`;
    tb.append(tr);
  });
  document.getElementById('history-container').style.display='block';
}

// 11) Thống kê lỗi sai
document.getElementById('show-analytics-btn').onclick=()=>{
  const hist=JSON.parse(localStorage.getItem(user+'_history')||'[]');
  const cnt={};
  hist.forEach(r=>(r.mistakes||[]).forEach(w=>cnt[w]=(cnt[w]||0)+1));
  const ent=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels=ent.map(e=>e[0]), vals=ent.map(e=>e[1]);
  const ctx=document.getElementById('mistakeChart').getContext('2d');
  if (window.mistakeChart) window.mistakeChart.destroy();
  window.mistakeChart=new Chart(ctx,{
    type:'bar',
    data:{labels,datasets:[{label:'Lỗi sai',data:vals,backgroundColor:'#f44336'}]},
    options:{scales:{y:{beginAtZero:true}}}
  });
  const ul=document.getElementById('mistakeList');
  ul.innerHTML='';
  ent.forEach(([w,c])=>{
    const li=document.createElement('li');
    li.textContent=`${w}: ${c} lần`;
    ul.append(li);
  });
  document.getElementById('analytics').style.display='block';
};

// 12) Đăng nhập
document.getElementById('login-btn').onclick=()=>{
  const v=document.getElementById('username-input').value.trim();
  if (!v) return alert('Nhập tên tài khoản!');
  user=v; localStorage.setItem('quiz_user',user);
  initQuiz();
};

// 13) Utility shuffle
function shuffle(a){ return a.sort(()=>Math.random()-0.5); }

// Start
loadData();
