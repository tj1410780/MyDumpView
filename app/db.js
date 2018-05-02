//mssql模块简单封装   
var mssql = require('mssql'); //app文件夹中执行npm install mssql命令， 引入mssql依赖 (version4.1.0)
var db = {};

//sql server configuration
var config = {
//本地sql server数据库
//	user: 'offline_dumpview',
//	password: 'amd135',
//	server: '192.168.56.1',
//	database: 'dumpview',
//	port: 62013,
//  port: 6389, //sql server默认监听的端口号是1433, 但要通过资源监视器中的TCP连接查看sqlserver.exe实际监听的端口!!!

	user: 'dvol',
	password: 'Amd12345',
	server: 'SHDUMPVIEWPRD01',
	database: 'DumpViewOffLineDB',
	port: 1433,
	options: {
		encrypt: true // Use this if you're on Windows Azure--Windows Azure是微软基于云计算的操作系统
	},
	pool: {
		min: 0,
		max: 10,
		idleTimeoutMillis: 3000
	}
};
//建立数据库连接(只建立一个连接（全局），每次执行sql语句都要拿到这个连接),20毫秒左右
var connection = new mssql.connect(config, err => {
	if(err) {
		console.log(err);
		return;
	}
});

db.sql = function(sql, callBack) {
	const transaction = new mssql.Transaction(connection); //对于插入操作，一定要开启事务，否则应用中的sql语句不会自动提交（spring中单一操作不需要）
	transaction.begin(err => { //开启事务
		if(err) {
			callBack(err, null);
			return;
		}
		const request = new mssql.Request(transaction); //拿到操作数据库的对象request(将 SQL语句发送到数据库中?)
		request.query(sql, (err, result) => { //执行SQL语句
			if(err) {
				callBack(err, null);
				return;
			}
			callBack(null, result.toString());
			
			transaction.commit(err => { //提交事务
				if(err) {
					callBack(err, null);
					return;
				}
				console.log("Transaction is committed.");
				callBack(null, "Success");
			});
		});

	});
	
};

module.exports = db; //导出db模块

//执行sql,返回数据 
//db.sql = function(sql, callBack) {
//	var connection = new mssql.connect(config, function(err) {
//		if(err) {
//			console.log(err);
//			return;
//		}
//		var ps = new mssql.PreparedStatement(connection);
//		ps.prepare(sql, function(err) {
//			if(err) {
//				console.log(err);
//				return;
//			}
//			ps.execute('', function(err, result) {
//				if(err) {
//					console.log(err);
//					return;
//				}
//				ps.unprepare(function(err) {
//					if(err) {
//						console.log(err);
//						callback(err, null);
//						return;
//					}
//					callBack(err, result);
//				});
//			});
//		});
//	});
//};

//db.sql = function(sql, callBack) {
//	console.log('start');
//	mssql.connect(config, err => {
//		console.log(err);
//		const request = new mssql.Request()
//		request.stream = true //开启streaming
//		request.query(sql) //或者执行request.execute(procedure)
//		request.on('recordset', columns => {
//			//每次查询会触发一次 recordset事件，返回结果集
//			console.log(columns)
//		})
//		request.on('row', row => {
//			//每个结果集会出发row事件，返回row信息
//			console.log(row);
//		})
//		request.on('error', err => {
//			//监听error事件，可能被触发多次
//			console.log(err);
//		})
//		request.on('done', result => {
//			//最后触发
//			console.log(result);
//			mssql.close();
//		})
//	})
//
//}
//
//mssql.on('error', err => {
//	//error 处理
//	console.log(err);
//})