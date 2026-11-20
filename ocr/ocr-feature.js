/* 截图识别菜谱：所有识别均在当前浏览器中完成，结果须经用户确认后才填入编辑栏。 */
(function(){
'use strict';
const unitPattern='克|千克|公斤|斤|毫升|升|ml|mL|g|kg|个|只|颗|粒|片|块|根|把|朵|杯|碗|勺|汤匙|茶匙|小勺|大勺|适量|少许';
const headings={ingredients:/^(食材|用料|材料|调料|配料|食材清单)[：:]?$/i,steps:/^(做法|步骤|制作方法|烹饪步骤|操作步骤)[：:]?$/i,tips:/^(小贴士|提示|注意事项|备注)[：:]?$/i};
const cleanLine=s=>s.replace(/[\u200b\ufeff]/g,'').replace(/[|丨]/g,'｜').replace(/\s+/g,' ').replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g,'$1').trim();
function stripNumber(s){return s.replace(/^\s*(?:步骤\s*)?(?:第?[一二三四五六七八九十]+[步、.：:]?|\d{1,2}[.、)）:：]|[①②③④⑤⑥⑦⑧⑨⑩])\s*/,'').trim();}
function ingredientLine(line){
  let s=line.replace(/^[-•·●○□✓✔]\s*/,'').replace(/[：:]/,' ');
  const match=s.match(new RegExp('^(.{1,24}?)\\s*(约?\\d+(?:\\.\\d+)?(?:\\s*[-~—至]\\s*\\d+(?:\\.\\d+)?)?|适量|少许)\\s*('+unitPattern+')?\\s*(.*)$','i'));
  if(match){const amount=/^\d+(?:\.\d+)?$/.test(match[2])?Number(match[2]):match[2];return {name:match[1].trim(),amount,unit:(match[3]||'').trim(),substitute:match[4].replace(/^[/（(]|[）)]$/g,'').trim()};}
  const parts=s.split(/\s{2,}|[｜]/).map(x=>x.trim()).filter(Boolean);
  if(parts.length>=2 && parts[0].length<=24)return {name:parts[0],amount:parts[1],unit:parts[2]||'',substitute:parts.slice(3).join(' ')};
  return null;
}
function parseRecipeText(text){
  const lines=String(text||'').split(/\r?\n/).map(cleanLine).filter(Boolean);
  const result={name:'',minutes:20,servings:2,tags:['截图识别'],ingredients:[],steps:[],tips:[],uncertain:[]};
  let section='';
  const titleCandidates=[];
  for(const original of lines){
    let line=original;
    if(headings.ingredients.test(line)){section='ingredients';continue;}
    if(headings.steps.test(line)){section='steps';continue;}
    if(headings.tips.test(line)){section='tips';continue;}
    const time=line.match(/(?:时间|耗时|用时)?\s*(\d{1,3})\s*分钟/);if(time)result.minutes=Math.min(1440,Math.max(1,Number(time[1])));
    const servings=line.match(/(?:份量|分量|份数|适合)?\s*(\d{1,2})\s*(?:人份|人|份)/);if(servings)result.servings=Math.min(99,Math.max(1,Number(servings[1])));
    if((time||servings)&&/时间|耗时|用时|人份|份量|分量|份数/.test(line))continue;
    if(/^(菜名|名称)[：:]/.test(line)){result.name=line.replace(/^(菜名|名称)[：:]\s*/,'').slice(0,60);continue;}
    if(section==='ingredients'){
      const ing=ingredientLine(line);if(ing){result.ingredients.push(ing);continue;}
      if(!/时间|分钟|人份|收藏|点赞|评论/.test(line))result.uncertain.push(line);
      continue;
    }
    if(section==='steps'){const step=stripNumber(line);if(step.length>3)result.steps.push(step);else result.uncertain.push(line);continue;}
    if(section==='tips'){result.tips.push(stripNumber(line));continue;}
    const numbered=/^(?:步骤\s*)?(?:第?[一二三四五六七八九十]+[步、.：:]?|\d{1,2}[.、)）:：]|[①②③④⑤⑥⑦⑧⑨⑩])/.test(line);
    if(numbered){result.steps.push(stripNumber(line));continue;}
    const ing=ingredientLine(line);
    if(ing&&(/\d|适量|少许/.test(line))){result.ingredients.push(ing);continue;}
    if(line.length>=2&&line.length<=24&&!/时间|分钟|人份|食材|做法|步骤|小贴士|收藏|点赞|评论/.test(line))titleCandidates.push(line);
    else if(line.length>3)result.uncertain.push(line);
  }
  if(!result.name&&titleCandidates.length)result.name=titleCandidates[0].replace(/[《》【】]/g,'').slice(0,60);
  if(!result.steps.length){const candidates=result.uncertain.filter(x=>x.length>=8);result.steps=candidates.slice(0,12);result.uncertain=result.uncertain.filter(x=>!result.steps.includes(x));}
  result.ingredients=result.ingredients.slice(0,80);result.steps=result.steps.slice(0,30);result.tips=result.tips.slice(0,20);
  return result;
}
function ingredientText(items){return items.map(i=>[i.name,i.amount,i.unit,i.substitute||''].join('｜')).join('\n');}
function renderParsed(){
  const p=parseRecipeText($('ocrRaw').value);$('ocrName').value=p.name;$('ocrMinutes').value=p.minutes;$('ocrServings').value=p.servings;
  $('ocrIngredients').value=ingredientText(p.ingredients);$('ocrSteps').value=p.steps.join('\n');$('ocrTips').value=p.tips.join('\n');
  $('ocrUncertain').textContent=p.uncertain.length?'以下文字没有自动归类，请核对原文：'+p.uncertain.join('；'):'已完成初步分类。仍请逐项核对图片中的数量和步骤。';
  $('ocrUncertain').classList.toggle('ok',!p.uncertain.length);
}
function previewFiles(files){
  const box=$('ocrPreviews');box.replaceChildren();
  [...files].forEach((file,index)=>{const wrap=document.createElement('figure'),img=document.createElement('img'),cap=document.createElement('figcaption');const url=URL.createObjectURL(file);img.src=url;img.alt='待识别截图 '+(index+1);img.onload=()=>URL.revokeObjectURL(url);cap.textContent=file.name;wrap.append(img,cap);box.append(wrap);});
}
let worker=null,working=false;
async function getWorker(){
  if(worker)return worker;if(!window.Tesseract)throw Error('本地识别程序未加载，请刷新后重试');
  const base=new URL('.',document.baseURI);const path=p=>new URL(p,base).href;
  worker=await Tesseract.createWorker('chi_sim',1,{workerPath:path('ocr/worker.min.js'),langPath:path('ocr/lang/'),corePath:path('ocr/core/'),logger:m=>{if(m.status){const percent=Number.isFinite(m.progress)?' '+Math.round(m.progress*100)+'%':'';$('ocrStatus').textContent='正在准备识别：'+m.status+percent;}}});
  return worker;
}
async function recognize(){
  const files=[...$('ocrFiles').files];if(!files.length){toast('请先选择一张或多张截图');return;}if(working)return;
  working=true;$('ocrStart').disabled=true;$('ocrFill').disabled=true;$('ocrProgress').hidden=false;
  try{const engine=await getWorker(),texts=[];for(let i=0;i<files.length;i++){$('ocrStatus').textContent=`正在识别第 ${i+1}/${files.length} 张…`;const result=await engine.recognize(files[i]);texts.push(result.data.text.trim());}
    $('ocrRaw').value=texts.filter(Boolean).join('\n\n');renderParsed();$('ocrStatus').textContent='识别完成。请核对下方内容，再填入编辑栏。';$('ocrFill').disabled=false;
  }catch(e){console.error(e);$('ocrStatus').textContent='自动识别没有成功。你仍可把手机识别出的文字粘贴到下方，再点“重新整理”。';$('ocrRaw').focus();}
  finally{working=false;$('ocrStart').disabled=false;}
}
function openOcr(){
  if($('recipeEditor').open)$('recipeEditor').close();$('ocrDialog').showModal();document.body.classList.add('locked');
  $('ocrModeHint').textContent=location.protocol==='file:'?'当前是本地文件模式；部分浏览器会限制识别程序。若失败，可使用已发布网页或粘贴手机识别文字。':'图片只在当前浏览器中识别，不会上传；首次识别可能需要十几秒。';
  setTimeout(()=>$('ocrFiles').focus(),0);
}
function fillEditor(){
  const name=$('ocrName').value.trim(),ings=$('ocrIngredients').value.trim(),steps=$('ocrSteps').value.trim();if(!name||!ings||!steps){alert('请先补齐菜名、食材和步骤，再填入编辑栏。');return;}
  blankEditor();$('editName').value=name;$('editTags').value='截图识别, 家常菜';$('editMinutes').value=Number($('ocrMinutes').value)||20;$('editServings').value=Number($('ocrServings').value)||2;$('editIngredients').value=ings;$('editSteps').value=steps;$('editTips').value=$('ocrTips').value.trim();$('editNote').value='由截图文字识别后人工核对录入；请按原图确认用量、火候和食品安全。';
  $('ocrDialog').close();showDialog($('recipeEditor'));setTimeout(()=>$('editName').focus(),0);toast('已填入编辑栏，请确认后再保存');
}
function resetOcr(){$('ocrFiles').value='';$('ocrPreviews').replaceChildren();['ocrRaw','ocrName','ocrIngredients','ocrSteps','ocrTips'].forEach(id=>$(id).value='');$('ocrMinutes').value=20;$('ocrServings').value=2;$('ocrStatus').textContent='选择截图后开始识别，也可以直接粘贴已识别文字。';$('ocrUncertain').textContent='';$('ocrFill').disabled=true;}
$('openOcr').onclick=openOcr;$('ocrFiles').onchange=()=>{previewFiles($('ocrFiles').files);$('ocrStart').disabled=!$('ocrFiles').files.length;};$('ocrStart').onclick=recognize;$('ocrParse').onclick=()=>{renderParsed();$('ocrFill').disabled=!$('ocrName').value.trim();toast('已重新整理文字');};$('ocrFill').onclick=fillEditor;$('ocrReset').onclick=resetOcr;
window.RecipeOCR={parseRecipeText,ingredientText};
})();
