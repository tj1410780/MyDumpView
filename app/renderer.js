const {ipcRenderer, shell, remote} = require('electron');
const ipc = ipcRenderer;
const {dialog, Menu, app} = remote;
var fs = require('fs'); //读取目录或者文件内容
let dumpFilePaths = null;
let targetDir = "";
let symbolPathValue = "";
let symbolPath = "";
let length = 0;
let newLength = 0;
let array = new Array();
let newArray = new Array();
let fileInfo = null;
let isFinished = true;
let map = new Map();
let fileArray = new Array();
let appPath = "";
let jsPath = "";
let cssFile = "";
let jqueryFile = "";          //读取jquery.min.js中的内容
let bootstrapFile = "";       //读取bootstrap.min.js中的内容
let db = null;
  


//接收主进程发来的消息，做出相应的应答
ipcRenderer.on('action', function(event, arg) {
    switch(arg){        
	    case 'set': //设置symbol path
	    //todo: 弹出一个新的对话框
	    	$('#myModal').modal('show');
	        break;
	        
	    case 'save':     //设置保存的文件夹路径，默认跟dump files同一个文件夹   
	        const selectedDir = remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
	        	title: 'Select a Destination',
			    properties: ['openDirectory'],
			   	//defaultPath: 'C:',
	        });
	        if(selectedDir){
	        	targetDir = String(selectedDir);
	        }
	        break;
	        
    	case 'exiting':
	        askIfExit();
	        break;
	}
});


//选择dump文件
var selectFileBtn = document.getElementById('select-file');
selectFileBtn.addEventListener('click', function (event) {
	const dumpFilePath = remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
  	title: 'Select Dump Files',
    properties: ['openFile', 'multiSelections'],
    //defaultPath: 'C:',
    filters: [	
      { name: 'Dump files', extensions: ['dmp', 'DMP']},
    ], 
    });
    if (dumpFilePath) {
    	document.getElementById('dumpFiles').value = String(dumpFilePath);   	
    	document.getElementById('notice_1').innerHTML = "";
    	dumpFilePaths = dumpFilePath;
	}	
});


//设置symbol path
var configBtn = document.getElementById('setSymbolPath');
configBtn.addEventListener('click', function (event) {
  	symbolPathValue = document.getElementById('mySymbolPath').value.replace(/\r\n/g, '').replace(/\n/g, '').replace(/\s/g, '');
  	if (symbolPathValue == "") {
  		document.getElementById('warn').style.color = "#C9302C";	
  		document.getElementById('warn').innerHTML = "Please enter symbol path!";
  	} else {
		ipc.send('set-symbol-path', symbolPathValue);
  	}
});


//若设置失败则提示失败
ipc.on('setting_failure', function (event) {
	document.getElementById('warn').style.color = "#C9302C";
	document.getElementById('warn').innerHTML = "The setting of symbol path is failed!";  	
});

//若设置成功则提示成功
ipc.on('setting_success', function (event) {
	symbolPath = symbolPathValue;
	document.getElementById('warn').style.color = "forestgreen";
	document.getElementById('warn').innerHTML = "Success!";
	document.getElementById('notice_1').innerHTML = "";
});


//清空symbol path
var clearBtn = document.getElementById('clearSymbolPath');
clearBtn.addEventListener('click', function (event) {
  	document.getElementById('mySymbolPath').value = "";
  	document.getElementById('warn').innerHTML = "";
});


//监测symbol path框的输入
document.getElementById('mySymbolPath').oninput=(e)=>{
	document.getElementById('warn').innerHTML = "";
};


//根据用户选中的文件生成FileInfo对象, 并将对象放入数组
function createArray(dumpFilePath) {
	newLength = dumpFilePath.length;
    for (var i = 0; i < newLength; i++) {
	    fileInfo = new FileInfo(dumpFilePath[i], 'preparing');   //加入数组中，为准备执行状态
	    newArray[i] = fileInfo;
    }
  	array = newArray.concat(array); //与之前的数组合并
	  newArray.splice(0, newLength);      //一定要清空newArray!!!否则只是修改数组里面的值，再将新数组与原来的array合并，出错
  	length += newLength;
}

//对所有选中的dump file进行分析
var analyzeBtn = document.getElementById('analyze');
analyzeBtn.addEventListener('click', function (event) {

	if (document.getElementById('dumpFiles').value == "") {
		document.getElementById('notice_1').innerHTML = "Please choose dump files!";
		return;
	}
	if (symbolPath == "") {
		document.getElementById('notice_1').innerHTML = "Symbol path is null!";
		return;
	}
	
	document.getElementById('dumpFiles').value = "";
	document.getElementById('notice_1').innerHTML = "";
	document.getElementById('warn').innerHTML = "";
	
	createArray(dumpFilePaths);
	
	//start to analyze
	if (targetDir == "") {
		targetDir = getDefaultTargetDir(array[0].path);
	}
	
	//同步读取目标文件夹里面的文件放入files数组，并筛选后缀为.txt的文件放入fileArray数组
	var files = fs.readdirSync(targetDir);	
	files.forEach(function(file) {
	    if (file.indexOf('.txt') != -1) {
	        file = targetDir.concat('\\' + file);    //只有文件名，所以一定要拼接成绝对路径
	        fileArray.push(file);
	    }
	});
	
function readJsFiles() {
	var index = appPath.lastIndexOf('\\');
	jsPath = appPath.substring(0, index);           //获取打包成app.asar文件后的应用的上一级目录
	cssFile = fs.readFileSync(jsPath + '/js/bootstrap.min.css').toString();
	jqueryFile = fs.readFileSync(jsPath + '/js/jquery.min.js').toString();
	bootstrapFile = fs.readFileSync(jsPath + '/js/bootstrap.min.js').toString();	
}

	
	//将每次选择的dump文件的目标路径与目标文件夹里的所有文件进行比较，
	//若存在则map的值+1，dump文件的目标路径进行更新，再与目标文件夹里的文件进行比较，直到没有重复的为止，
	//这时该dump文件的目标路径就是最后一次更新后的值
	for (var i = 0; i < newLength; i++) {
			var targetPath = getTargetPath(array[i].path, targetDir);
			array[i].targetPath = targetPath;
			map.set(targetPath, 0);
			var flag = 1;
			while (flag > 0) {    //while(flag)也对
				var j = 0;	
				for (j = 0; j < fileArray.length; j++) {
					if (array[i].targetPath == fileArray[j]) {
						var count = map.get(targetPath) + 1;
						map.set(targetPath, count);                 //关键的一步
						array[i].targetPath = targetPath.replace('.txt', '(' + count + ').txt');
						break;
					}
				}
				if (j == fileArray.length) {
					flag = 0;                   //跳出循环
				}
			}
			ipc.send('analyze', array[i].path, array[i].targetPath);
			array[i].status = 'analyzing';
  	}  
  	fileArray.splice(0, fileArray.length);          //一定要清空数组里的内容（push是从尾部加入新的元素）！！
  	//页面开始渲染，table内容显示
  	showTable(); 	
  	$("#myPanel").show();
  	
  	if (cssFile == "" || jqueryFile == "" || bootstrapFile == "" ) {
  		readJsFiles();
  	}

});

//分析失败（命令执行失败）则提示fail
ipc.on('exe_failure', function (event, dumpFilePath, targetPath) {
	var resultHtml = targetPath.replace('txt', 'html');
	var data = fs.readFileSync(targetPath);   //得到的是object
	data = data.toString();   //转化为xml字符串
	var str = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + resultHtml + '</title><style>' + cssFile + '</style><script>' + jqueryFile + '</script><script>' + bootstrapFile + '</script></head>';
	str += '<body><br/><div class="container-fuild body-content" style="margin:25px;"><div class="panel panel-default">';
	str += '<div class="panel-heading"><h3 class="panel-title" align="center">The analysis process was failed!</h3></div>';
	str += '</div></div></body></html>';
	//str += '<div id="data"><div class="panel-body"><pre>' + data + '</pre></div></div></div></div></body></html>';
	
	fs.writeFileSync(resultHtml, str);
	for (var i = 0; i < length; i++) {
		if (array[i].path == String(dumpFilePath) && array[i].targetPath == String(targetPath)) {
			array[i].status = 'failed';
			array[i].resultHtml = resultHtml;
			break;
		}
	}
	showTable();
});


//分析成功则提示finished
ipc.on('exe_success', function (event, dumpFilePath, targetPath) {
	var resultHtml = targetPath.replace('txt', 'html');
	for (var i = 0; i < length; i++) {
		if (array[i].path == String(dumpFilePath) && array[i].targetPath == String(targetPath)) {
			array[i].status = 'finished';
			array[i].resultHtml = resultHtml;
			break;
		}
	}	
	var time = getTime();
	var resultArray = new Array();
	var data = getContent(targetPath);
	parseData(data, resultArray);
	createHtml(dumpFilePath, resultHtml, resultArray, time);
	showTable();                  //重新渲染页面

	//将data进行处理，将'进行转义（变成''），否则里面的单引号会引起sql语句的提前结束！！
	var data_1 = data.replace(/\'/g, "''");                            // //g是全局标志， \是转义，\'代表的就是'
	//var data_1 = data.replace(/\'/g, "''").replace(/\"/g, '""');   //双引号没关系	
	var index = dumpFilePath.lastIndexOf('\\');          //获得dump file的文件名
	var fileName = dumpFilePath.substring(index + 1);
	//将结果上传sql server数据库(sql语句中的字段的值一定要加上单引号)
	var insertSql = "insert into DumpViewOffLineDB.dbo.result (dump_file, end_time, bugcheck, summary, information) values ('" + fileName + "','" + time + "','" + resultArray[0].information + "','" + resultArray[1].information + "','" +  data_1 + "');";
	
	db.sql(insertSql, function(err, result){     //整个上传时间为2-3毫秒
	    if (err) {  
	        console.log(err);  
	        return;  
	    }  
	    console.log('result: ' + result);  
	});  

});

function getTime() {
	var date = new Date();
	var year = date.getFullYear();
	var month = date.getMonth() + 1;
	var day = date.getDate();
	var hour = date.getHours();
	var minute = date.getMinutes();
	var second = date.getSeconds();
	var m = "";
	if (hour < 12) {
		m = "AM";
	} else {
		m = "PM";
		if (hour > 12) {
			hour = hour % 12;
		}
	}
	if (minute < 10) {
		minute = '0' + minute;
	}
	if (second < 10) {
		second = '0' + second;
	}
	var time = month + '/' + day + '/' + year + ' ' + hour + ':' + minute + ':' + second + ' ' + m;
	return time;
}

//获取分析结果文件里的内容
function getContent(path) {
	var data = fs.readFileSync(path);   //得到的是object
	data = data.toString();   //转化为xml字符串
	return data;
}

//解析结果文件里的信息（xml格式），将各节点信息封装成对象，放入resultArray数组中
function parseData(data, resultArray) {
    var a = $.parseXML(data);   //a是data这个XMLw的解析器
    var i = 2;
    //提取bugcheck节点的属性bugcheckid的值
    $(a).find('bugcheck').each(function() {
    	var bugcheckid = $(this).attr('bugcheckid');
    	resultInfo = new ResultInfo('Bugcheck', bugcheckid);
    	resultArray[0] = resultInfo;
    });
    
    $(a).find('result').each(function() {
    	var conclusion = $(this).text();
    	resultInfo = new ResultInfo('Analysis Summary', conclusion);
    	resultArray[1] = resultInfo;
    });
  
    $(a).find('command').each(function() {
    	var title = $(this).attr('txt');
		var data = $(this).text();
		resultInfo = new ResultInfo(title, data);
		resultArray[i++] = resultInfo;
    });
}

//根据解析xml文件得到的信息生成html文件
//注意引入的顺序， bootstrap.min.css --> jquery.min.js --> bootstrap.min.js,顺序错了css的效果会消失 
function createHtml(filePath, path, arr, time) {
	var str = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + path + '</title>';
	str += '<style>' + cssFile + '.nav-tabs {margin-top: 20px;border-radius: 4px;border: 1px solid #ddd;box-shadow: 0 1px 4px rgba(0, 0, 0, 0.067);}'; 
	str += 'ul.nav-tabs li {margin: 0;border-top: 1px solid #ddd;}ul.nav-tabs li:first-child {border-top: none;}ul.nav-tabs li a {margin: 0;padding: 3px 8px;border-radius: 0;}'; 
	str += 'ul.nav-tabs li.active a, ul.nav-tabs li.active a:hover {color: #fff;background: #0088cc;border: 1px solid #0088cc;}';
	str += 'ul.nav-tabs li:first-child a { border-radius: 4px 4px 0 0;}ul.nav-tabs li:last-child a {border-radius: 0 0 4px 4px;}ul.nav-tabs.affix {top: 10px;}</style>';
	str += '<script>' + jqueryFile + '</script><script>' + bootstrapFile + '</script></head>';
	str += '<body data-spy="scroll" data-target="#myScrollspy">';
	str += '<div class="container-fuild body-content" style="margin:25px;">';
	str += '<div class="panel panel-default"><div class="panel-heading"><h3 class="panel-title">';
  str += '<a data-toggle="collapse" data-parent="#accordioninfo" href="#collapseinfo">Job Information</a></h3></div>';
  str += '<div id="collapseinfo" class="panel-collapse collapse in"><div class="panel-body">';
  str += '<dl class="dl-horizontal" style="font-size: larger;"><dt>Dump File</dt><dd>' + filePath + '</dd><dt>End Time</dt><dd>' + time + '</dd><dt>Bugcheck</dt><dd>' + arr[0].information + '</dd></dl>';
  str += '</div></div></div>';
	str += '<div class="panel panel-default"><div class="panel-heading"><h3 class="panel-title"><a data-toggle="collapse" data-parent="#accordionsummary" href="#collapseSummary">Analysis Summary</a></h3></div>';
	str += '<div id="collapseSummary" class="panel-collapse collapse in"><div class="panel-body"><pre>' + arr[1].information + '</pre></div></div></div>';
	str += '<div class="panel panel-default"><div class="panel-heading"><h3 class="panel-title"><a data-toggle="collapse" data-parent="#accordionoutput" href="#collapseOutput">Windbg Output</a></h3></div>';
	str += '<div id="collapseOutput" class="panel-collapse collapse in"><div class="panel-body"><div class="row"><div class="col-lg-10 col-md-12">';
	for (var i = 2; i < arr.length; i++) {
	    str += '<h4 id="item_' + i + '">' + arr[i].title + '</h4><pre>' + arr[i].information + '</pre>';
	}
	str += '</div><nav class="col-lg-2 hidden-md hidden-sm hidden-xs" id="myScrollspy"><ul data-spy="affix" data-offset-top="750" class="nav nav-tabs nav-stacked">';
	for (var i = 2; i < arr.length; i++) {
		str += '<li><a href="#item_' + i + '">' + arr[i].title + '</a></li>';
	}  
	str += '</ul></nav></div></div></div></div>';
	str += '<hr /><footer><p>&copy; 2018 - Offline Dump View Application V1.0</p></footer></div></body></html>';
	fs.writeFileSync(path, str);
}

//每次执行结果后， 文件状态改变后刷新列表，展示最新的内容
function showTable() {
	var content = '<div class="panel panel-default" id="myTable"><div class="panel-heading text-center"><h3>Status</h3></div>';
	content += '<table class="table table-hover"><thead><tr><th>#</th><th>Dump File</th><th>Status</th><th>Result</th></tr></thead>';
  content += '<tbody>';
	for (var i = 0; i < length; i++) {
		content += '<tr>';
		content += '<th>' + (i + 1) + '</th>';
		content += '<td>' + array[i].path + '</td>';
		if(array[i].status == 'analyzing') {
			content += '<td class="color_1">' + array[i].status + '</td>';
		} else if (array[i].status == 'failed') {
			content += '<td class="color_2">' + array[i].status + '</td>';
		} else {
			content += '<td>' + array[i].status + '</td>';
		}
		if (array[i].status == 'analyzing') {
			content += '<td><button type="button" class="btn btn-link btn-sm" disabled="disabled" data-htmlPath="' + array[i].resultHtml + '">Check</button></td>';			
		} else {
			content += '<td><button type="button" class="btn btn-link btn-sm" data-htmlPath="'  +  array[i].resultHtml + '">Check</button></td>';
		}
		content += '</tr>';
	}
	content += '</tbody></table></div>';
	$("#myPanel").html(content);
}


//页面初始化时显示symbol path输入框中的值
$(document).ready(function(){
	//应用打开时面板关闭状态
	$("#myPanel").hide();
	
	ipc.send('search-symbolPath');

	//获取应用所在目录(app文件夹的绝对路径)
	appPath = app.getAppPath();

//判断应用是否位于本地
	if (appPath.startsWith('\\\\')) {
		console.log(appPath);
		const response = dialog.showMessageBox(remote.getCurrentWindow(), {
        message: 'Please download the application to local use',
        type: 'info',
        buttons: ['OK']
    	});
	    if(response == 0) {
	    	ipc.send('res-action', 'exit');
	    }
	}

//事件冒泡监听所有的按钮
	$('#myPanel').on('click', 'button', function(event){
		var $target = $(event.target);        //拿到被点击的按钮元素
		var targetFile = $target.attr('data-htmlPath');      //获得该元素的data-htmlPath属性的值，即获得该分析结果的html文件的绝对路径
		shell.openItem(targetFile);
	});
	
	db = require('./db');      //加载db模块 
		
});


//页面初始化时查找环境变量_NT_SYMBOL_PATH,
//未设置则输入框中的值为空
ipc.on('search-failure', function (event) {
	document.getElementById('mySymbolPath').value = "";
});

//已设置则在输入框中显示symbol path的值
ipc.on('search-success', function (event, kv) {
	console.log(kv);
	var index = kv.indexOf('=');
	symbolPath = kv.substring(index + 1);
	console.log(symbolPath);
	document.getElementById('mySymbolPath').value = symbolPath;
});


//获取默认保存路径的文件夹
function getDefaultTargetDir(dumpFilePath) {
	var index = dumpFilePath.lastIndexOf('\\');
	var defaultTargetDir = dumpFilePath.substring(0, index);
	return defaultTargetDir;
}

//获取分析后文件保存的绝对路径
function getTargetPath(dumpFilePath, targetDirectory) {
	var index_1 = dumpFilePath.lastIndexOf('\\');
	var index_2 = dumpFilePath.lastIndexOf('.');
	//get fileName and suffix of the dump file separately
	var fileName = dumpFilePath.substring(index_1);   //获取文件名
	var suffix = dumpFilePath.substring(index_2);  //获取文件名后缀
	var targetPath = targetDirectory.concat(fileName).replace(suffix, '.txt');
	return targetPath;
}

//根据各个对象的状态判断是否退出
function askIfExit(){
	for (var i = 0; i < length; i++) {
		if (array[i].status == 'analyzing') {
			isFinished = false;
			break;
		}
	}
    if(isFinished) {
    	ipc.send('res-action', 'exit');
    	return;
    }
    const response = dialog.showMessageBox(remote.getCurrentWindow(), {
        message: 'There are still files analyzing. Do you want to Exit?',
        type: 'question',
        buttons: [ 'Yes', 'No' ]
    });
    if(response == 0) {
    	ipc.send('res-action', 'exit');
    }
    isFinished = true;   //必须重置
}


//用函数创建一个对象，该对象中包含dump文件的路径并记录该文件的状态
function FileInfo(path, status, targetPath, resultHtml) {
	this.path = path;
	this.status = status;
	this.targetPath = targetPath;
	this.resultHtml = resultHtml;
}

//将每个分析结果的xml文件的结点的标题和内容生成一个对象
function ResultInfo(title, information) {
	this.title = title;
	this.information = information;
}

