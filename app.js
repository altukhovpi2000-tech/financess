(function(){
  var VERSION='0.5.9';
  var ENDPOINT='https://script.google.com/macros/s/AKfycbyPS6WBIB-y7VlY_MQYNRMFkTU2IOQpPYtxNJ3nhrApTXlqcmtFOKhWNfhw2AkSUkfDfw/exec';
  var SECRET='koshka-2026-tl48xq91';
  var KEY='my-expenses-v1';

  var MONTHS=['января','февраля','марта','апреля','мая','июня',
              'июля','августа','сентября','октября','ноября','декабря'];

  function el(id){return document.getElementById(id);}

  function money(n){
    return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)+' ₽';
  }

  var today=new Date();
  function localDate(d){
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  // «2026-11-21» -> «21 ноября 2026»
  function humanDate(s){
    var p=String(s).split('-');
    if(p.length!==3){return String(s);}
    return Number(p[2])+' '+MONTHS[Number(p[1])-1]+' '+p[0];
  }

  el('date').value=localDate(today);
  el('month').value=localDate(today).slice(0,7);

  var editingId=null;
  var records=[];
  try{
    var stored=localStorage.getItem(KEY);
    if(stored){records=JSON.parse(stored);}
    if(!Array.isArray(records)){records=[];}
  }catch(e){records=[];}

  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify(records));}
    catch(e){el('message').textContent='Не удалось сохранить локально. Скачай резервную копию.';}
  }

  function safe(s){
    return String(s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function kindWord(kind){
    if(kind==='income')return 'доход';
    if(kind==='saving')return 'подушка';
    return 'расход';
  }

  function kindCode(kind){
    if(kind==='доход')return 'income';
    if(kind==='подушка')return 'saving';
    return 'expense';
  }
    var CATS_EXPENSE=['Еда и вода','Регулярные траты','Бытовые траты','Транспорт','Здоровье','Развлечения','Подписки','Прочее'];
  var CATS_INCOME=['Зарплата','Другое поступление'];

  function updateCategories(){
    var kind=el('kind').value;
    var sel=el('category');
    if(kind==='saving'){
      sel.innerHTML='<option value="—">—</option>';
      sel.disabled=true;
      return;
    }
    var list=(kind==='income')?CATS_INCOME:CATS_EXPENSE;
    sel.innerHTML=list.map(function(c){return '<option value="'+c+'">'+safe(c)+'</option>';}).join('');
    sel.disabled=false;
  }

  el('kind').addEventListener('change',updateCategories);


    var MONTHS_EN={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  function normDateStr(v){
    var s=String(v);
    if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
    var m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    if(m)return m[3]+'-'+m[2]+'-'+m[1];
    m=s.match(/[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})(?:\s+(\d{4}))?/);
    if(m){
      var mo=MONTHS_EN[m[1].toLowerCase()];
      if(mo)return (m[2]||String(new Date().getFullYear()))+'-'+String(mo).padStart(2,'0')+'-'+String(Number(m[3])).padStart(2,'0');
    }
    return s.slice(0,10);
  }


  function sendToSheet(r){
    if(!ENDPOINT||ENDPOINT.indexOf('http')!==0){return;}
    var payload={token:SECRET,id:r.id,date:r.date,kind:kindWord(r.kind),category:r.category,amount:r.amount,note:r.note||''};
    fetch(ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload)})
      .then(function(){el('message').textContent='Запись сохранена и отправлена в Google Таблицу.';})
      .catch(function(){el('message').textContent='Сохранено на устройстве, но в таблицу не ушло — проверь интернет.';});
  }

  function sendDelete(r){
    if(!ENDPOINT||ENDPOINT.indexOf('http')!==0){return;}
    var payload={token:SECRET,action:'delete',id:r.id,date:r.date,kind:kindWord(r.kind),category:r.category,amount:r.amount};
    fetch(ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload)}).catch(function(){});
  }

    function sendUpdate(r){
    if(!ENDPOINT||ENDPOINT.indexOf('http')!==0){return;}
    var payload={token:SECRET,action:'update',id:r.id,date:r.date,kind:kindWord(r.kind),category:r.category,amount:r.amount,note:r.note||''};
    fetch(ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload)}).catch(function(){});
  }

    function loadFromSheet(silent){
    if(!ENDPOINT||ENDPOINT.indexOf('http')!==0){return;}
    if(!silent){el('message').textContent='Загружаю из таблицы…';}
    fetch(ENDPOINT+'?token='+encodeURIComponent(SECRET),{method:'GET',mode:'cors'})
      .then(function(r){return r.json();})
      .then(function(data){
        if(!data.ok){throw new Error(data.error||'bad');}
        var raw=data.records.length;
        var fresh=data.records.map(function(r){
          return {id:Number(r.id)||Date.now(),date:normDateStr(r.date),kind:kindCode(String(r.kind).trim().toLowerCase()),category:String(r.category),amount:Number(r.amount),note:r.note||''};
        }).filter(function(r){
          return /^\d{4}-\d{2}-\d{2}$/.test(r.date)&&isFinite(r.amount)&&r.amount>0;
        });
        var seen={};
        fresh=fresh.filter(function(r){
          if(seen[r.id]){return false;}
          seen[r.id]=true;
          return true;
        });
        records=fresh;
        persist();
        render();
        var sample=raw>0
          ? ' Пример: ['+String(data.records[0].date)+' | '+String(data.records[0].kind)+' | '+String(data.records[0].category)+' | '+String(data.records[0].amount)+']'
          : '';
        el('message').textContent='Диагностика: пришло '+raw+', прошло фильтр '+records.length+' (версия '+VERSION+').'+sample;
      })
      .catch(function(){
        el('message').textContent=silent?'':'Не удалось загрузить из таблицы. Проверь интернет и попробуй ещё раз.';
      });
  }

  function render(){
    var m=el('month').value;
    var list=records.filter(function(r){return r.date.slice(0,7)===m;});
    list.sort(function(a,b){return b.date.localeCompare(a.date)||b.id-a.id;});

    function sum(type){
      return list.filter(function(r){return r.kind===type;}).reduce(function(a,r){return a+r.amount;},0);
    }
    var income=sum('income'),spent=sum('expense'),saving=sum('saving');

        el('income').textContent=money(income);
    el('spent').textContent=money(spent);
    el('savings').textContent=money(saving);
    var balance=income-spent-saving;
    el('balance').textContent=money(balance);

    var card=el('balance').closest('.stat-card');
    card.classList.remove('bal-red','bal-yellow','bal-green','bal-gold');
    if(balance<=-10000){card.classList.add('bal-red');}
    else if(balance<5000){card.classList.add('bal-yellow');}
    else if(balance<=10000){card.classList.add('bal-green');}
    else{card.classList.add('bal-gold');}

    var cats={};
    list.filter(function(r){return r.kind==='expense';}).forEach(function(r){
      if(!cats[r.category]){cats[r.category]=0;}
      cats[r.category]+=r.amount;
    });
    var parts=Object.keys(cats).sort(function(a,b){return cats[b]-cats[a];}).map(function(k){
      return safe(k)+': <b>'+money(cats[k])+'</b>';
    });
    el('categoryTotals').innerHTML=parts.length?parts.join(' · '):'Расходов по категориям пока нет.';

    el('count').textContent=list.length+' записей';

    if(!list.length){
      el('entries').innerHTML='<div class="empty">За этот месяц записей пока нет.</div>';
      return;
    }
    var html='';
    list.forEach(function(r){
      var label=r.kind==='income'?'Доход':(r.kind==='saving'?'Подушка безопасности':'Расход');
      var sign=r.kind==='expense'?'−':'+';
      html+='<div class="entry"><div class="row">'
        +'<div style="min-width:0"><div class="entry-title">'+safe(r.category)+(r.note?' — '+safe(r.note):'')+'</div>'
        +'<div class="entry-meta">'+safe(humanDate(r.date))+' · '+label+'</div></div>'
        +'<div class="row"><span class="amount">'+sign+money(r.amount)+'</span>'
        +'<button class="btn-edit" type="button" data-edit="'+r.id+'">✎</button>'
        +'<button class="btn-danger" type="button" data-del="'+r.id+'">Удалить</button></div>'
        +'</div></div>';
    });
    el('entries').innerHTML=html;
  }

  el('form').addEventListener('submit',function(e){
    e.preventDefault();
    var amount=Number(el('amount').value);
    if(!Number.isFinite(amount)||amount<=0){
      el('message').textContent='Введи сумму больше нуля.';
      return;
    }
        var kind=el('kind').value;
    var category=el('category').value;
    if(kind==='saving'){category='—';}
    var rec={
      id:Date.now()+Math.floor(Math.random()*1000),
      date:el('date').value,
      kind:kind,
      category:category,
      amount:amount,
      note:el('note').value.trim()
    };
    records.push(rec);
    persist();
    el('month').value=rec.date.slice(0,7);
    render();
    sendToSheet(rec);
    el('amount').value='';
    el('note').value='';
  });

    el('entries').addEventListener('click',function(e){
    var d=e.target.closest('[data-del]');
    if(d){
      var id=Number(d.getAttribute('data-del'));
      var idx=-1;
      for(var i=0;i<records.length;i++){if(Number(records[i].id)===id){idx=i;break;}}
      if(idx<0){return;}
      sendDelete(records[idx]);
      records.splice(idx,1);
      persist();
      render();
      el('message').textContent='Запись удалена на устройстве и в таблице.';
      return;
    }
    var b=e.target.closest('[data-edit]');
    if(!b){return;}
    var rec=null;
    for(var j=0;j<records.length;j++){if(Number(records[j].id)===Number(b.getAttribute('data-edit'))){rec=records[j];break;}}
    if(!rec){return;}
    editingId=rec.id;
    el('editId').value=rec.id;
    el('editDate').value=rec.date;
    el('editKind').value=rec.kind;
    fillEditCategories(rec.kind,rec.category);
    el('editAmount').value=rec.amount;
    el('editNote').value=rec.note||'';
    el('editPanel').style.display='block';
    el('editPanel').scrollIntoView({behavior:'smooth',block:'start'});
  });

    function fillEditCategories(kind,selected){
    var sel=el('editCategory');
    if(kind==='saving'){
      sel.innerHTML='<option value="—">—</option>';
      sel.disabled=true;
    }else{
      var list=(kind==='income')?CATS_INCOME:CATS_EXPENSE;
      sel.innerHTML=list.map(function(c){return '<option value="'+c+'">'+safe(c)+'</option>';}).join('');
      sel.disabled=false;
      if(selected&&selected!=='—'&&list.indexOf(selected)<0){
        sel.insertAdjacentHTML('afterbegin','<option value="'+safe(selected)+'">'+safe(selected)+'</option>');
      }
    }
    if(selected){sel.value=selected;}
  }

  el('editKind').addEventListener('change',function(){fillEditCategories(el('editKind').value,'');});

  el('editForm').addEventListener('submit',function(e){
    e.preventDefault();
    var idx=-1;
    for(var i=0;i<records.length;i++){if(records[i].id===editingId){idx=i;break;}}
    if(idx<0){el('editPanel').style.display='none';return;}
    var amount=Number(el('editAmount').value);
    if(!Number.isFinite(amount)||amount<=0){
      el('message').textContent='Введи сумму больше нуля.';
      return;
    }
    var kind=el('editKind').value;
    var category=el('editCategory').value;
    if(kind==='saving'){category='—';}
    var rec=records[idx];
    rec.date=el('editDate').value;
    rec.kind=kind;
    rec.category=category;
    rec.amount=amount;
    rec.note=el('editNote').value.trim();
    persist();
    el('month').value=rec.date.slice(0,7);
    render();
    sendUpdate(rec);
    el('editPanel').style.display='none';
    el('message').textContent='Запись обновлена на устройстве и в таблице.';
  });

  el('editCancel').addEventListener('click',function(){el('editPanel').style.display='none';});

  el('month').addEventListener('change',render);

  el('sync').addEventListener('click',function(){loadFromSheet(false);});

  function download(name,content,type){
    var blob=new Blob([content],{type:type});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;
    a.download=name;
    a.click();
    setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }

  el('backup').addEventListener('click',function(){
    download('moi-rashody-backup.json',JSON.stringify(records,null,2),'application/json');
  });

  el('export').addEventListener('click',function(){
    var m=el('month').value;
    var rows=[['Дата','Тип','Категория','Сумма','Комментарий']];
    records.filter(function(r){return r.date.slice(0,7)===m;}).forEach(function(r){
      rows.push([r.date,r.kind,r.category,r.amount,r.note||'']);
    });
    var csv='\uFEFF'+rows.map(function(row){
      return row.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(';');
    }).join('\n');
    download('rashody-'+m+'.csv',csv,'text/csv;charset=utf-8');
  });

  el('restore').addEventListener('change',function(e){
    var f=e.target.files[0];
    if(!f){return;}
    f.text().then(function(text){
      var data=JSON.parse(text);
      if(!Array.isArray(data)){throw new Error('bad');}
      records=data.map(function(r){
        return {id:Number(r.id)||Date.now()+Math.random(),date:normDateStr(r.date),kind:r.kind,category:r.category,amount:Number(r.amount),note:r.note||''};
      });
      persist();
      render();
      el('message').textContent='Резервная копия восстановлена.';
    }).catch(function(){
      el('message').textContent='Не получилось прочитать файл резервной копии.';
    });
    e.target.value='';
  });

    updateCategories();
  render();
  loadFromSheet(true);
})();
