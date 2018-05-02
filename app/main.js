const {
	app,
	dialog,
	BrowserWindow,
	ipcMain,
	Menu
} = require('electron');
const {
	exec
} = require('child_process');
const ipc = ipcMain;
const path = require('path');
const url = require('url');
//var elevate = require('windows-elevate');

let isExit = false;
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600
	});

	// and load the index.html of the app.
	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true
	}));

	// Open the DevTools.
	//mainWindow.webContents.openDevTools();

	mainWindow.on('close', function(event) {
		if(!isExit) {
			event.preventDefault();
			mainWindow.webContents.send('action', 'exiting');
		}
	});

	// Emitted when the window is closed.
	mainWindow.on('closed', function() {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
	});
}

ipcMain.on('res-action', function(event, arg) {
	switch(arg) {
		case 'exit':
			isExit = true;
			app.quit(); //退出程序
			break;
	}

});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function() {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if(process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('activate', function() {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if(mainWindow === null) {
		createWindow();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.



//创建主菜单
const template = [
	{
	    label: 'Settings',
	    submenu: [
			{
				label: 'Symbol Path',
				click() {
					mainWindow.webContents.send('action', 'set');
				},
				accelerator: 'CmdOrCtrl+W',
			},
			{  
				label: "Result Folder",
			    click(){
			      mainWindow.webContents.send('action', 'save'); //点击后向主页渲染进程发送“打开文件”的命令
			    },
			    accelerator: 'CmdOrCtrl+S' //快捷键：Ctrl+S
		  	}
        ]
    },

	{
		role: 'help',
		submenu: [
			{
				label: 'Learn More',
				click() {
					require('electron').shell.openExternal('http://confluence.amd.com/display/RSCE/How+to+use+offline+Dump+View+Application');
					//require('electron').shell.openItem(app.getAppPath() + '\\README.txt');
				}
			}
		]
	}
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

ipc.on('search-symbolPath', function(event) {
	exec('set _NT_SYMBOL_PATH', function(error, stdout, stderr) {
		if(error) {
			event.sender.send('search-failure');
		} else {
			event.sender.send('search-success', stdout);
		}
	});
});

//设置symbol path环境变量
ipc.on('set-symbol-path', function(event, symbolPath) {
		//elevate.exec('setx -m', '_NT_SYMBOL_PATH "' + symbolPath + '"', function(error, stdout, stderr) {
		exec('setx _NT_SYMBOL_PATH "' + symbolPath + '"', function(error, stdout, stderr) {
		if(error) {
			event.sender.send('setting_failure');
		} else {
			event.sender.send('setting_success');
		}
		//event.sender.send('logging', stdout, stderr);
	});
});

//DumpPlusWorker2 /f c:\dump\memory.dmp > c:\results\memory.txt
ipc.on('analyze', function(event, dumpFilePath, targetPath) {
	//Closure
	function foo_1(innerDumpFilePath, innerTargetPath) {
		//pay attention to the ""   exec:开启一个shell进程，执行命令
		exec('DumpPlusWorker2 /f "' + innerDumpFilePath + '" /out=xml > "' + innerTargetPath + '"', function(error, stdout, stderr) {
			if(error) {
				event.sender.send('exe_failure', innerDumpFilePath, innerTargetPath);
			} else {
				event.sender.send('exe_success', innerDumpFilePath, innerTargetPath);
			}
		});
	}
	foo_1(dumpFilePath, targetPath);

    //测试shell进程(远程)是否启用成功，结果显示子进程创建成功，因此是命令执行失败
//	exec('notepad C:\\test\\hello.txt', function(error, stdout, stderr) {	  
//	});
});




