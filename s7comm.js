"use strict";
/**************************************************************************************
* Copyright (c) 2017 Hilscher Gesellschaft fuer Systemautomation mbH
* See LICENSE
***************************************************************************************
* $Id:  $:
* Description:
* A Node-RED node to communicate with Siemens S7 PLCs
**************************************************************************************/

// System library
var util = require("util");
var events = require("events");
var StringDecoder = require('string_decoder').StringDecoder;

// 3rd-party library
var NodeS7=require("nodes7");
var locks = require('locks');

//show console logs of nodeS7 and Node-RED node
var logLevelNodeS7={"debug":1,"silent":true};//debug:-1=show nothing, 0=show error, 1=show error+warning+info
var logLevelNodeRED={"debug":1,"silent":true};//debug:-1=show nothing, 0=show error, 1=show error+warning, 2=show error+warning+info;  


/**
 * @description This function returns the time as an object in three different formats
 * @returns	{Object} time as object with parameters:
 * @returns	{Object} obj.timeObject - Javascript Date Object
 * @returns	{String} obj.year - year-month-date, hours:minutes:sec:ms
 * @returns	{String} obj.time - hours:minutes:sec:ms
 */
function timestamp(){
	var myDate=new Date();
	var smonth=(myDate.getMonth()+1);
	switch(smonth){
		case 1:smonth="Jan";	break;
		case 2:smonth="Feb";	break;
		case 3:smonth="Mar";	break;
		case 4:smonth="Apr";	break;
		case 5:smonth="May";	break;
		case 6:smonth="Jun";	break;
		case 7:smonth="Jul";	break;
		case 8:smonth="Aug";	break;
		case 9:smonth="Sep";	break;
		case 10:smonth="Oct";break;
		case 11:smonth="Nov";break;
		case 12:smonth="Dec";break;
	}
	return {
		"format_Object":myDate,
		"format_year":myDate.getFullYear()+"-"+(myDate.getMonth()+1)+"-"+myDate.getDate()+", "+myDate.getHours()+":"+myDate.getMinutes()+":"+myDate.getSeconds()+":"+myDate.getMilliseconds(),
		"format_time":myDate.getHours()+":"+myDate.getMinutes()+":"+myDate.getSeconds()+":"+myDate.getMilliseconds(),
		"format_NodeRed":myDate.getDate()+" "+smonth+" "+myDate.getHours()+":"+myDate.getMinutes()+":"+myDate.getSeconds(),
	};	
}

/**
 * @description Checks if the given value is an numeric value or a string representing a numeric value
 * @param {anyVal} n - A value that has to be tested
 * @returns	{bool} true in case of a numeric value else false
 *  console.log(isNumeric(true))	//false
 * 	console.log(isNumeric(1))		//true
 * 	console.log(isNumeric(1.01)) 	//true
 * 	console.log(isNumeric(1e10)) 	//true
 * 	console.log(isNumeric("1")) 	//true
 * 	console.log(isNumeric("1.4")) 	//true
 * 	console.log(isNumeric("1e5")) 	//true
 * 	console.log(isNumeric("a")) 	//false
 * 	console.log(isNumeric("1a")) 	//false
 */
function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * @description An output function with a defined debug/logging-level                    
 * @param {} txt- log text
 * @param {} debugLevel -  -1=show nothing; 0=show error ; 1=show error+warning ;2=show error+warning+info 
 * @param {} id -
 * @requires util
 * @requires {Object} logLevelObject that defines silentmode and level
 * @example:           
 * var util=require('util')
 * //debug:(Number),-1=show nothing,0=show error,1=show error+warning,2=show error+warning+info;  silent:(bool),true=don't show logs, false=show logs
 
 * //within the src-code
 * outputLog("always_shown");
 * outputLog("[node-Error]- message",0);
 * outputLog("[node-Warning]- message",1);
 * outputLog("[node-Info]- message",2);
 */
function outputLog(txt, debugLevel, id) {
	if(logLevelNodeRED.silent===true){ return;}
	var idtext;
	if (typeof(id) === 'undefined') {
		idtext = '';
	} else {
		idtext = ' ' + id;
	}

	//var time=process.hrtime();
	var time=timestamp().format_NodeRed;
	if (typeof(debugLevel) === 'undefined' || logLevelNodeRED.debug  >= debugLevel) { console.log('[' + time + idtext + '] ' + util.format(txt)); } 
}

/**
 * @description Creates an array with the length "len" and fill it with "val"
 * @param	{Number} - Length of the return Array
 * @param	{String|Number|Object|Array|bool|etc} - Value of each digit
 * @returns	{Array} Array with the length "len" and fill it with "val"
 * @example
 * FilledArray(3,"0");  //returns ["0","0","0"]
 */
function FilledArray(len, val) {
	var array = [];
	for (var i = 0; i < len; i++) {
		array[i] = val;
	}
	return array;
}	

/**
 * @description This function returns the minimum of an Array
 * @param	{Array} - Array of numbers only!! 			
 * @returns	{Number} - Minimum Value of the input Array
 * @examples
 * Array.min([1,2,3,4])
 * //returns 1
 */
Array.min = function( array ){
	return Math.min.apply( Math, array );
};

/**
 * @description Create due to some random Error a list filled with Bad 255 from the 
 * nodes7 parameter polledReadBlockList which consist all items of the polling list
 * @param {Object} nodeS7.polledReadBlockList - Parameter comes from NodeS7 Object within the library!
 * @todo finish documentation
 * @returns	{Object} 
 * @example
 * var x=createBadList(nodeS7.polledReadBlockList)
 * //returns {"MB0":["BAD 255"],"QB0-3":["BAD 255","BAD 255","BAD 255"]}
 */
function createBadList(S7_List){
	var arr=[];
	var obj={};
	var ret={};		
	for (var i=0; i < S7_List.length; i++) {
		obj.signal=S7_List[i].useraddr;
		obj.arrLen=S7_List[i].arrayLength;
		arr[i]=obj;			
		obj={};
	}
	for (var j=0; j < arr.length; j++) {
		ret[arr[j].signal]=FilledArray(arr[j].arrLen,"BAD 255");
	}
	return ret;
}

/**
 * @description Checks the range of the writing value and sets it in case of an overloaded value to a valid one 
 * @param {Object} node - A node object from the Node-RED Instance
 * @param {Array} val- The writing values that comes from the HTML-side.
 * @returns {Array} The (corrected)value that you are actually writing to the PLC
 * @example
 * 	checkWritingValue(node,[1,3,256]); //return [1,3,1] in case of Bytes
 */	
function checkWritingValue(node,val){
	var ret=null;
	var tmp=[];
	var err=null;
	var fatalError=false;

	for (var i = 0; i < val.length; i++){
		tmp[i]=val[i];
		err=false;
		if(node.rcvData.S7_Datatype=='B'||node.rcvData.S7_Datatype=='uint8'){//Byte=0x00 <= Byte <= 255
			if(val[i] < 0x00){
				//err=true;
				tmp[i]=0;
			}else{
				tmp[i]= val[i]%(255+1);
			}
		}
		if(node.rcvData.S7_Datatype=='W'||node.rcvData.S7_Datatype=='uint16'){//Word=0x0000 <= Word <= 65535
			if(val[i] < 0){
				//err=true;
				tmp[i]=0;
			}else{
				tmp[i]= val[i]%(65535+1);
			}
		}
		if(node.rcvData.S7_Datatype=='D'||node.rcvData.S7_Datatype=='uint32'){//0x00000000 <= DWord <= 4294967295
			if(val[i] < 0){
				//err=true;
				tmp[i]=0;
			}else{
				tmp[i]= val[i]%(4294967295+1);
			}
		}
		if(node.rcvData.S7_Datatype=='I'||node.rcvData.S7_Datatype=='int16'){//-32768 <= INT <= 32767
			if(val[i] < 0){
				tmp[i]= val[i]%(32768+1);
			}else if(val[i] > 0){
				tmp[i]= val[i]%(32767+1);
			}else{
				tmp[i]= val[i]%(32767+1);
			}
		}

		if(node.rcvData.S7_Datatype=='DI'||node.rcvData.S7_Datatype=='int32'){//-2147483648 <= INT <= 2147483647	
			if(val[i] < 0){
				tmp[i]= val[i]%(2147483648+1);
			}else if(val[i] > 0){
				tmp[i]= val[i]%(2147483647+1);
			}else{
				tmp[i]= val[i]%(2147483647+1);
			}
		}
		if(node.rcvData.S7_Datatype=='X'){
			if(typeof(val[i]) != "boolean"){
				fatalError=true;
			}
		}
		if(node.rcvData.S7_Datatype=='CHAR'){
			var x='';
			if(typeof(val[i]) != "string"){
				fatalError=true;
			}else{
				if((val[i]).length > 1){
					err=true;
					x=(val[i]).slice(0, 1);				
				}else{
					x=val[i];
				}
				if(x===''){
					tmp[i]=' ';
				}else{
					tmp[i]=x;
				}
			}
		}
		if(node.rcvData.S7_Datatype=='STRING'){
			if(typeof(val[i]) != "string"){
				fatalError=true;
			}else{
				if((val[i]).length > node.rcvData.S7_Quantity){
					err=true;
					tmp[i]=(val[i]).slice(0, node.rcvData.S7_Quantity);
				}
			}
		}
		if(node.rcvData.S7_Datatype=='R'){
			if(val[i] < 0x00){
				//err=true;
				tmp[i]=0;
			}else{
				if (isNumeric(val[i])) {
					tmp[i]= val[i];
				}else{
					tmp[i]=0;
					err=true;
				}
			}
		}
		if(node.rcvData.S7_Datatype=='TIMER'){

		}
		if(node.rcvData.S7_Datatype=='COUNTER'){
			
		}
	}
	if(fatalError === true){
		ret=null;
	}else{
		//writingValue is always an array so redefine item
		if(node.rcvData.S7_Quantity > 1){
			//cut off the overload of the array
			if (isNumeric(node.rcvData.S7_Quantity)) {
				ret={"error":err,"value":[tmp.slice(0,parseInt(node.rcvData.S7_Quantity))]};
				if(node.rcvData.S7_Datatype=='CHAR'||node.rcvData.S7_Datatype=='STRING'){		
					ret={"error":err,"value":tmp};
				}else{
					ret={"error":err,"value":[tmp.slice(0,parseInt(node.rcvData.S7_Quantity))]};
				}
			}else{
				//value of Quantity Field is not a number
				tmp[i]=0;
				err=true;
			}
		}else{
			ret={"error":err,"value":tmp};
		}		
	}
	return ret;
}

/**
 * @description This function analyses the response of the PLC. It is used within a callback in the node
 * @param {Object} node - A node object from the Node-RED Instance
 * @param {Object} val - returnobject of function checkWritingValue
 * @param {Object} cb - callback of singleWriting function

 * @example
 * write(node,function(cb){
 *    writingComplete(node,x,cb);
 * });
 */
function writingComplete(node,val,cb){
	var err=null;
	var value=null;
	if(cb){
		//writing OK
		var tmp=node.NodeConfig.writeDataBuffer;//tmp={anythingBad:bool};			
		if(Object.keys(tmp).length === 0 && tmp.constructor === Object){//Check if DataBuffer is empty
			outputLog("[node-Warning] - No response values from writing request available",1);
			node.NodeConfig.writeJSON=getJSON("error",node,null,-1,[null]);
		}else{	
			if(tmp.anythingBad===true){
				err=-1;
			}
			if(tmp.anythingBad===false){
				err=0;
			}
			if(val.error===true){
				err=-1;
			}
			if(val.error===false){
				err=0;
			}
			if(node.rcvData.S7_Quantity > 1){
				if(node.rcvData.S7_Datatype =="STRING" || node.rcvData.S7_Datatype =="CHAR" ){
					value=val.value;
				}else{
					value=val.value[0];
				}
			}else{
				value=val.value;
			}
			node.NodeConfig.writeJSON=getJSON("write",node,node.rcvData.S7_Name,err,value);
	}
	}else{
		outputLog("[node-Warning] - Timeout during writing Process.",1);
		node.NodeConfig.writeJSON=getJSON("error",node,null,-1,[null]);
	}
	//if(tmp.err<0){node.status({fill:"yellow",shape:"dot",text:"error"});}
	node.send(node.NodeConfig.writeJSON);
}

/**
 * @description NodeS7 is using for read Requests a polling list. See API.
 * This function is used for having access to the API-Function addItems and removeItems to work with the nodes7 internal polling list.
 * @param {Object} node - A node object from the Node-RED Instance
 * @param {String} choose - use "add" for adding an item into the list and "remove" for removing an item from the list
 * @example
 * pollinglist(node,"add")
 */
function pollinglist(node,choose){
	var arr=[];
	arr.push(node.wrappedData);
	if(choose==='add'){
		node.NodeConfig.sps.addItems(arr);
	}else if(choose==='remove'){
		node.NodeConfig.sps.removeItems(arr);
	}
}

/**
 * @description Give this function an S7 Object and it'll return the Datatype.
 * @param	{Object} S7Object - The S7-Object that comes from the HTML-Page
 * @param 	{Number} choose -  Choose 0 or 1 for different format. 1 for using with DB, 0 for using with the rest
 * @returns {String} A string that shows the Datatype of the input Signal
 * @todo Extend this Function when using more Datatypes e.g Int,DInt ...
 * @example 
 * getDataTypeAsString(S7Object,1)  //S7Object={S7_Type:"" ,S7_DBnum:"0",S7_Datatype:"",S7_Offset:"0",S7_BitOffset:"0",S7_Quantity:"0",S7_Name:""}
 * //returns BYTE
 */	
function getDataTypeAsString(S7Object,choose){
	var ret="";	
	//	possible cases are grabbed from the Node-RED HTML file. Object operators2 within oneditprepare in the configuration part!!
	switch(S7Object.S7_Datatype){
		case "X":
			if(choose===1){ret="X";}
			if(choose===0){ret="X";}
			break;
		case "B":
		case "uint8":
			if(choose==1){ret="BYTE";}
			if(choose===0){ret="B";}
			break;
		case "W":
		case "uint16":
			if(choose===1){ret="WORD";}
			if(choose===0){ret="W";}
			break;
		case "D":
		case "uint32":
			if(choose===1){ret="DWORD";}
			if(choose===0){ret="D";}	
			break;				
		case "I":
		case "int16":
			if(choose===1){ret="INT";}
			if(choose===0){ret="I";}
			break;	
		case "DI":
		case "int32":
			if(choose===1){ret="DINT";}
			if(choose===0){ret="DI";}
			break;
		case "CHAR":
			if(choose===1){ret="CHAR";}
			if(choose===0){ret="C";}
			break;	
		case "STRING":
			if(choose===1){ret="STRING";}
			if(choose===0){ret="S";}
			break;		
		case "R":
			if(choose===1){ret="REAL";}
			if(choose===0){ret="R";}
			break;
		case "TIMER":
			if(choose===1){ret="TIMER";}
			if(choose===0){ret="TIMER";}//placeholder!
			break;	
		case "COUNTER":
			if(choose===1){ret="COUNTER";}
			if(choose===0){ret="COUNTER";}//placeholder!
			break;	
		default:
			ret=undefined;
	}
	return ret;
}

/**
 * @description NodeS7 has it's own Syntax for a Request. This Function creates the Syntax for a NodeS7-Request.
 * @param	{Object} S7Object - The S7-Object that comes from the HTML-Page
 * @param {String} choose - use "data" for ... and "path" for ...
 * @returns {String} A string that defines the Syntax for the Request
 * @todo Extend this Function when using more Datatypes e.g Int,DInt ...
 * @example 
 * wrapData(S7Object)(S7Object)
 * //returns EB0 => S7Object={S7_Type:"" ,S7_DBnum:"0",S7_Datatype:"",S7_Offset:"0",S7_BitOffset:"0",S7_Quantity:"0",S7_Name:""}
 */
function wrapData(S7Object,choose){
	var ret=S7Object;
	switch(S7Object.S7_Type){
		case "I":
		case "Q": //X,BYTE,WORD,DWORD,INT,DINT,CHAR,STRING,R,TIMER,COUNTER
		case "M":
		case "PI":
		case "PQ":
			if(S7Object.S7_Datatype=="X"){
				//Bool
				ret=S7Object.S7_Type+S7Object.S7_Offset+"."+S7Object.S7_BitOffset;//I0.0	
			}else if(S7Object.S7_Datatype=="CHAR"){
				//CHAR
				ret=S7Object.S7_Type+getDataTypeAsString(S7Object,0)+S7Object.S7_Offset;	//MC0
			}else{
				//BYTE,WORD,DWORD,INT,DINT,STRING,R,TIMER,COUNTER
				if(S7Object.S7_Quantity >1){
					if(choose==="path"){
						ret=S7Object.S7_Type+getDataTypeAsString(S7Object,0)+S7Object.S7_Offset+".."+(S7Object.S7_Quantity-1);	//IB0-IBx into IB0..x
					}else if(choose==="data"){
						ret=S7Object.S7_Type+getDataTypeAsString(S7Object,0)+S7Object.S7_Offset+"."+S7Object.S7_Quantity;		//IB0-IBx into IB0.x
					}else{
						ret=null;
					}
				}else{
					ret=S7Object.S7_Type+getDataTypeAsString(S7Object,0)+S7Object.S7_Offset;	//IB0
				}
			}
			break;
		case "DB":
			if(S7Object.S7_Datatype=="X"){
				//Bool
				ret=S7Object.S7_Type+S7Object.S7_DBnum+","+getDataTypeAsString(S7Object,1)+S7Object.S7_Offset+"."+S7Object.S7_BitOffset;	//DB10.DBX0.1  into  DB10,X0.1
			}else if(S7Object.S7_Datatype=="CHAR"){
				//CHAR
				ret=S7Object.S7_Type+S7Object.S7_DBnum+","+getDataTypeAsString(S7Object,1)+S7Object.S7_Offset;//DB10.DBC0 into 'DB10,CHAR0'
			}else{
				//BYTE,WORD,DWORD,INT,DINT,STRING,R,TIMER,COUNTER
				if(S7Object.S7_Quantity >1){
					//Quantity >1 (array)
					if(choose==="path"){
						ret=S7Object.S7_Type+S7Object.S7_DBnum+","+getDataTypeAsString(S7Object,1)+S7Object.S7_Offset+".."+(S7Object.S7_Quantity-1);//DB10.DBW0-DB10.DBW2   into 'DB10,WORD1..2'
					}else if(choose==="data"){
						ret=S7Object.S7_Type+S7Object.S7_DBnum+","+getDataTypeAsString(S7Object,1)+S7Object.S7_Offset+"."+S7Object.S7_Quantity;//DB10.DBW0-DB10.DBW2   into 'DB10,WORD1.2'
					}else{
						ret=null;//default
					}
					
				}else{
					ret=S7Object.S7_Type+S7Object.S7_DBnum+","+getDataTypeAsString(S7Object,1)+S7Object.S7_Offset;//DB10.DBW0 into 'DB10,WORD1'
				}
			}
			break;
		case "T":
			ret=S7Object.S7_Type+S7Object.S7_Offset;
			break;
		case "C":
			ret=S7Object.S7_Type+S7Object.S7_Offset;
			break;
		default:
			ret=null;
	}
	return ret;
}

/**
 * @description This function analyses the response of the PLC. It is used within a callback in the node
 * @param {Object} node - A node object from the Node-RED Instance
 * @example
 * read(node,function(retNode){
 *    readingComplete(retNode);
 * });
 */
function readingComplete(node){
	var tmp={};//buffer for receiving val {anythingBad:bool,values: { MB1: 5, MW10: 4, etc }}
	if(node.wrappedData===null){
			outputLog('[node-Error] - No Signal selected within the reading node',1);
			node.NodeConfig.readJSON=getJSON("error",node,null,-1,[null]);
	}else{
		if(Object.keys(node.NodeConfig.readDataBuffer).length === 0 && node.NodeConfig.readDataBuffer.constructor === Object){//Check if DataBuffer is empty (ECMA 5+)
			outputLog("[node-Error] - No response values from reading request available",1);
			node.NodeConfig.readJSON=getJSON("error",node,null,-1,[null]);
		}else{		
			tmp=checkReceivedData(node);
			node.NodeConfig.readJSON=getJSON("read",node,node.rcvData.S7_Name,tmp.err,tmp.arr);	
		}
	}
	//if(tmp.err<0){node.status({fill:"yellow",shape:"dot",text:"error"});}
	node.send(node.NodeConfig.readJSON);
}

/**
 * @description This function checks the return object of a reading process and sets the the Quality and value in a defined form.
 * The Node-RED node contains a parameter which represent the return value of an reading process see example.  
 * @param {Object} node - A node object from the Node-RED Instance
 * @returns {Object} - Obj.err=Errorvalue (Type=number; Obj.arr=Returnvalue(Type=Array)
 * @example
 * checkReceivedData(node); //With obj={anythingBad: false,values:{ 'DB11102,BYTE14.4':[ 3, 2, 97, 98 ]}} as return object of reading request
 * //return {err:0,arr:[ 3, 2, 97, 98 ]} 
 
  */
function checkReceivedData(node){
	var ret={"err":-1,"arr":[null]};	
	var data=node.NodeConfig.readDataBuffer;
	if(node && data.values){
		var tmpVal=data.values[node.wrappedData];
		//A response value (tmpVal) can either be:
		//decimal value or string "BAD 255" if an Error occured
		//single Item or Array if the Quantity is >1
	
		if (tmpVal !==undefined){
			if(data.anythingBad===false){		//no Error
				ret.err=0;
				if(!Array.isArray(tmpVal)){		//single value!
					ret.arr=[tmpVal];
				}	
				if(Array.isArray(tmpVal)){		//array!
					ret.arr=tmpVal;
				}
			}else if(data.anythingBad===true){		//Error
				if(!Array.isArray(tmpVal)){			//single value!
					if(tmpVal === undefined || tmpVal === "BAD 255"){
						ret.err=-1;
						ret.arr=[null];
					}else{
						ret.err=0;
						ret.arr=[tmpVal];						
					}
				}
				if(Array.isArray(tmpVal)){			//array!
					ret.err=0;
					for (var i = 0; i < tmpVal.length-1; i++) {
						if (tmpVal[i] === undefined || tmpVal[i] === "BAD 255") {
							ret.err=-1;
							ret.arr.push(null);
						}else{
							ret.arr.push(tmpVal[i]);
						}
					}
				}
			}
		}
	}
	return ret;
}	

/**
 * @description This function returns a JSON Object which is used for sending to the nodes output
 * @param {String} request- use "read", "write" or "error" for the different Requests
 * @param {Object} node- A node object from the Node-RED Instance
 * @param {String} sig- Name of the signal within S7-Object
 * @param {Number} err- Errorvalue of PLC response (comes from checkReceivedData)
 * @param {Array} val- Return value of PLC response(comes from checkReceivedData)
 * @returns {Object} JSON-Object of each Request	
 * @example
 * var a=getJSON("write",node,'node.S7_Name',err,val);	//define data as JSON	
 * var b=getJSON("error",node,null,-1,[null]);	//ERRORHANDLING
 * var c=getJSON(); 									//an empty JSON object
 */	
function getJSON(request,node,sig,err,val){
	//"read",node.topic,rcvData,wrappedData,Quality,value
	var ret={"topic": "","payload": {"signal": "","path": "","error":-1,"value":""}};
	if(request==="read"||request==="write"){
		ret={"topic": node.topic,"payload": {"signal": sig,"path": node.wrappedPath,"error":err,"value":val}};
	}else if(request==="error"){
		ret={"topic": node.topic,"payload": {"signal": sig,"path": null,"error":-1,"value":val}};
	}
	return ret;
}

/**
 * @description Connection Handler for multiple NodeS7-Instances.
 * @requires nodes7,events
*/
var connectionPool = function () {
	var connections = {};
	return {
		get: function (connection) {
			var id = (1+Math.random()*4294967295).toString(16);
			if (!connections[id]) {
			  connections[id] = function () {
					var mySPS = new NodeS7(logLevelNodeS7);
					var state=null;
					var interval_id=null;
					var param=null;

					var obj = {
						_instances: 0,
						//API nodeS7
						initiateConnection: function(item,cb) {
							outputLog("[node-Function] - initiateConnection",3);
							param=item;
							mySPS.initiateConnection(item,cb);
						},
						dropConnection: function(done) {
							outputLog("[node-Function] - dropConnection",3);
							mySPS.isoclient.destroy();
							mySPS.connectionCleanup();
							obj.clearRessouces();
							done();
						},
						startWatchingStates: function() {
							outputLog("[node-Function] - startWatchingStates",3);
							obj.stopWatchingStates();
							interval_id = setInterval( function() {
								state=mySPS.isoConnectionState;
								if(state===0 && mySPS.isoclient._connecting ===false){obj.emitter.emit("apiState0",{});}// State disconencted & socket not connecting!
								if(state===1){obj.emitter.emit("apiState1",{});}// trying to connect
								if(state===2){obj.emitter.emit("apiState2",{});}// tcp connected, wait for rfc1006 connection
								if(state===3){obj.emitter.emit("apiState3",{});}// rfc1006 connected, wait for pdu
								if(state===4){obj.emitter.emit("apiState4",{});	}// connected
							}, 1000);	//endinterval
						},	
						stopWatchingStates: function() {
							outputLog("[node-Function] - stopWatchingStates",3);
							if (interval_id !== null) {
								clearInterval(interval_id);
								interval_id=null;
							}
						},
						clearRessouces: function() {
							outputLog("[node-Function] - clearRessouces",3);
							obj.stopWatchingStates();
							//if (connections != null) {connections = {};}
						},
						setTranslationCB: function(trans) {mySPS.setTranslationCB(items);},
						addItems: function(items) {mySPS.addItems(items);},
						removeItems: function(items) {mySPS.removeItems(items);},
						readAllItems: function(cb) {mySPS.readAllItems(cb);},
						writeItems: function(items, values,cb) {mySPS.writeItems(items, values,cb);},
						//methods for Event-Handling
						emitter: new events.EventEmitter(),
						on: function (a, b) { this.emitter.on(a, b); }, //for Event Handling (  .on("connect",...)  )						
						//internal NodeS7 functions to analyse stuff!
						isoConnectionState: function(){return mySPS.isoConnectionState;},
						isoclient: function(){return mySPS.isoclient;},
						resetNow: function(){return mySPS.resetNow();},
						polledReadBlockList: function(){return mySPS.polledReadBlockList;}

					};
				return obj;
			  }();
			}
			//connections[id]._instances += 1;
			return connections[id];
}};}();

/**
 * @summary The actual Node-RED node consisting of read, write and config node.
 */
module.exports = function(RED) {
	function S7Configuration(n) {
		RED.nodes.createNode(this,n);
		// Configuration Params passed by Node Red
		this.sps = connectionPool.get();//Configuration from connection pool
		this.connection = n.connection;
		this.RFCParam={port:n.port,host:n.ip,rack:n.rack,slot:n.slot};
		this.payload=n.payload;	
		this.globallist=n.globallist;
		// Configuration Params and flags for local usage
		var node=this;
		var mutex = locks.createMutex();
		var intervallNodes=0;
		var error=null;
		var readingTimeout=null;

		node.connected=false;	
		node.connecting=false;
		node.closing = false;		//unused
		node.reading=false;			//reading Flag
		node.writing=false;			//writing Flag
		node.users={}; 				//a list of all nodes wich are using these Configuration
		node.readDataBuffer={};		//a Buffer for the answer
		node.writeDataBuffer={};	//a Buffer for the answer	
		node.emptyBuffer=getJSON(); //an empty JSON object for Error handling
		node.readJSON={};			//a Buffer for reading JSON
		node.writeJSON={};			//a Buffer for writing JSON
		node.cnt={};				//buffer for calc within register method
		node.intervallTime=1000;	//default Value

		var connect=function(){
			node.connecting=true;
			node.connected=false;
			node.sps.initiateConnection(node.RFCParam,onPlcCallback);
	
			// State handlers
			node.sps.on("apiState0",function(){		// disconencted

				outputLog("[node-Warning] - PLC disconnected, trying to reconnect",1);
				node.connected = false;
				for (var id in node.users) {
					if (node.users.hasOwnProperty(id)) {
						node.users[id].status({fill:"red",shape:"dot",text:"disconnected"});
					}
				}
				//Reconnect
				// Check: -----------    API-Flags    --------------  &&  -------  TCP-Flags (bypass NodeS7 API and get information about TCP-Stack)-------
				if(node.connecting===false && node.connected===false && node.sps.isoclient()._connecting ===false &&node.sps.isoclient().destroyed===true){
					outputLog("[node-Warning] - TCP reconnection is starting",1);
					node.connecting=true;
					node.sps.stopWatchingStates();
					node.sps.resetNow();  		//reset NodeS7 to clear resetPending flag!
					setTimeout(function(){
						node.sps.initiateConnection(node.RFCParam,onPlcCallback);
					},1500); //Timeout has to be 1,5 sec because withing resetNow there's also an 1,5 sec timeout
				}else{
					outputLog("[node-Warning] - TCP is already connecting",1);
				}
			});
			node.sps.on("apiState1",function(){		// trying to connect
				node.connected = false;			
				for (var id in node.users) {
					if (node.users.hasOwnProperty(id)) {
						node.users[id].status({fill:"blue",shape:"dot",text:"TCP connecting"});
					}				
				}
			});
			node.sps.on("apiState2",function(){		// tcp connected, wait for rfc1006	
				node.connected = false;
				for (var id in node.users) {
					if (node.users.hasOwnProperty(id)) {
						node.users[id].status({fill:"blue",shape:"ring",text:"RFC1006 connecting"});
					}
				}
			});
			node.sps.on("apiState3",function(){		// rfc connected, wait for pdu	
				node.connected = false;
				for (var id in node.users) {
					if (node.users.hasOwnProperty(id)) {
						node.users[id].status({fill:"blue",shape:"dot",text:"S7 initializing"});
					}
				}
			});
			node.sps.on("apiState4",function(){		// connected
				for (var id in node.users) {
					if (node.users.hasOwnProperty(id)) {
						if(node.users[id].RW_Error===true){
							node.users[id].status({fill:"yellow",shape:"dot",text:"RW/Error"});
							node.users[id].RW_Error=false;
						}else{
							node.users[id].status({fill:"green",shape:"dot",text:"connected"});
						}
						//node.users[id].status({fill:"green",shape:"dot",text:"connected"});
					}
				}
			});
		};
		
		var onPlcCallback=function(err){
			node.connecting=false;
			if (typeof(err) !== "undefined"){
				outputLog("[node-Error] - Error during Connection Establishment to "+node.RFCParam.host.toString(),0);
				node.connected=false;
				error=err;
			}else{
				outputLog("[node-Info] - Connection Established to PLC "+node.RFCParam.host.toString() +":"+node.RFCParam.port.toString(),2);
				node.connected=true;
				error=null;
				
				for (var id in node.users) {
					if (node.users.hasOwnProperty(id) && node.users[id].none=="false") {
						intervallNodes++;//count the Quantity of intervall reading nodes 
					}
				}
				//Start intervall reading here if (intervall-)reading nodes are available and PLC-State=4(connected) 
				if(node.cnt.read >= 1 && intervallNodes >=1 && node.sps.isoConnectionState()===4){ 
					node.triggerIntervallReading(node);
				}
				//set KeepAlive 
				outputLog("[node-Info] - Start KeepAlive",2);
				var KeepAlive=node.sps.isoclient().setKeepAlive(true,10000);
			}
			node.sps.startWatchingStates();
		};	
		
		var singleReading=function(callback){
			node.reading=true;
			if(node.connected){
				mutex.timedLock(1000, function (error) {
					if (error) {
						node.readDataBuffer={"anythingBad":true,"values":createBadList(node.sps.polledReadBlockList())};
						node.reading=false;
						callback(false);
						if (mutex.isLocked) {mutex.unlock();}
					}else{
						node.sps.readAllItems(function(anythingBad, values){						
							node.readDataBuffer={"anythingBad":anythingBad,"values":values};
							node.reading=false;
							callback(true);
							if (mutex.isLocked) {mutex.unlock();}
						});
					}
					if (mutex.isLocked) {mutex.unlock();}
				});	
			}else{
				callback(false);
			}
		};
		
		var singleWriting=function(myNode,writingValue,callback){
			var item=null;
			var value=null;
			node.writing=true;
			if(node.connected){
				mutex.timedLock(1000, function (error) {			
					if (error) {
						node.writeDataBuffer={"anythingBad":true};
						node.writing=false;
						callback(false);
						if (mutex.isLocked) {mutex.unlock();}
					}else{			
						node.sps.writeItems([myNode.wrappedData],writingValue,function(anythingBad) {						
							node.writeDataBuffer={"anythingBad":anythingBad};		
							node.writing=false;
							if (mutex.isLocked) {mutex.unlock();}
							callback(true);
						});
					}
					if (mutex.isLocked) {mutex.unlock();}
				});	
			}else{
				callback(false);
			}
		};

		//Functions called by write and read nodes
	    node.register = function(myNode,callback){
			outputLog("[node-Info] - Register node:"+myNode.id.toString()+" (config:"+myNode.NodeConfig.id.toString(),")",2);
			node.users[myNode.id] = myNode;
			//poll node.user for counting the number of read/write nodes. (readNum==1 => starting readintervall) and for setting  the global reading intervall time
			node.cnt={"read":0,"write":0,"repeatValues_read":[]};
			for(var i in node.users){
				if(node.users[i].type ==='s7comm read'){//increase Quantity of nodes with name "read"
					node.cnt.read++;	
					//set intervall time
					if (node.users[i].repeat && !isNaN(node.users[i].repeat) && node.users[i].repeat > 0) {
						//Repeat choosed !!
						node.cnt.repeatValues_read.push(node.users[i].repeat);			//get repeat value and push it into an array
						node.intervallTime = (Array.min(node.cnt.repeatValues_read))/2;	//get Array minimum,set it to intervall time.
						if(node.intervallTime<200){node.intervallTime=200;}									
					}
					if (node.users[i].once) {
						//Once choosed !!
					}				
				}
				if(node.users[i].type ==='s7comm write'){//increase Quantity of writing nodes
					node.cnt.write++;
				}
			}
			//connect if just one node is available
			if (Object.keys(node.users).length === 1) {
				connect();	
			}
			callback();
		};
		
		node.deregister = function(myNode,done){
			outputLog("[node-Info] - Deregister node "+node.users[myNode.id].id,2);
			delete node.users[myNode.id];
			return done();
			/*
			if (node.closing) {
                return done();
			}
            if (Object.keys(node.users).length === 0) {
				
			   if (node.client && node.client.connected) {
                    return node.client.end(done);
                } else {
                    node.client.end();
                    return done();
                }
            }
            done();
			*/
        };

		node.triggerIntervallReading=function(){
			outputLog("[node-Info] - Trigger intervall reading process of PLC "+node.RFCParam.host.toString(),2);		
			function onRead(cb){
				//In case of an error readDataBuffer gets filled with BAD 255 which means Error. ReadDataBuffer is being proceed within readingComplete	
				// The rest of Data Handling is within the node, because each node has different content. readDataBuffer={anythingBad:bool,values: { MB1: 5, MW10: 4, etc }}
				if(!cb){
					outputLog("[node-Warning] - Error during intervall reading Process",1);			
				}
				
				if(readingTimeout !==null){
					clearTimeout(readingTimeout);
				}
				readingTimeout=setTimeout(function(){singleReading(onRead);},node.intervallTime);//Retrigger
			}			
			singleReading(onRead);																//Trigger
		};
		
		node.triggerSingleReading=function(myNode,callback){
			outputLog("[node-Info] - Trigger single reading process of PLC "+myNode.NodeConfig.RFCParam.host.toString(),2);			
			singleReading(function(cb){
				if(!cb){
					outputLog("[node-Warning] - Error during single reading Process",1);
				}
				callback(myNode);
			});
		};

		node.triggerSingleWriting=function(myNode,value){
			outputLog("[node-Info] - Trigger single writing process to PLC "+myNode.NodeConfig.RFCParam.host.toString(),2);	
			var val={};
			var tmpValue=null;
			//Content from input value has to be : value.payload={"value":[1]}
			if(myNode.wrappedData!==null && typeof(value.payload)=="object" && value.payload.value)
			{
				tmpValue=value.payload.value;
				val=checkWritingValue(myNode,tmpValue);

				if(val!=null){
					singleWriting(myNode,val.value,function(ret){
						writingComplete(myNode,val,ret);
					});
				}else{
					outputLog("[node-Error] - Error with writing value.",0);
					node.writeJSON=getJSON("error",myNode,null,-1,[null]);
					myNode.send(node.writeJSON);
				}
			}else{
				outputLog('[node-Error] - Error during writing process',0);
				node.writeJSON=getJSON("error",myNode,null,-1,[null]);
				myNode.send(node.writeJSON);
			}
		};
		
		node.on('close', function(done) {
			outputLog("[node-Info] - Closed Configuration: "+node.id,2);
			node.closing = true;
			if(readingTimeout !==null){
				clearTimeout(readingTimeout);
			}
			if (mutex.isLocked) {			
				mutex.unlock();
			}
			if (node.sps.emitter) {
				node.sps.emitter.removeAllListeners('apiState0');
				node.sps.emitter.removeAllListeners('apiState1');
				node.sps.emitter.removeAllListeners('apiState2');
				node.sps.emitter.removeAllListeners('apiState3');
				node.sps.emitter.removeAllListeners('apiState4');
			}		
            if (node.connected) {
				node.sps.dropConnection(function(){
					node.connected=false;	
					node.connecting=false;
					node.reading=false;
					node.writing=false;
					done();
				});
            } else {
                done();
            }
			for (var id in node.users) {
				if (node.users.hasOwnProperty(id)) {
					node.users[id].status({fill:"red",shape:"dot",text:"disconnected"});
				}
			}
		});
	}
	RED.nodes.registerType("s7comm",S7Configuration);


    function S7Read(n) {
		RED.nodes.createNode(this,n);
		// Node Params passed by Node Red
		this.id=n.id;
		this.type=n.type;
		this.connection =n.connection;
		this.NodeConfig = RED.nodes.getNode(this.connection);
		this.topic=n.topic;
		this.name=n.name;
		this.globallist=n.globallist;
		this.payload=n.payload;
		//parameter for repeating mechanism
		this.repeat = n.repeat;
        this.crontab = n.crontab;
        this.once = n.once;
		this.none=n.none; //none=true means readTrigger once; none=false means readTrigger in intervall

		//local parameter & functions
		var node = this;		
		node.interval_id = null;
		node.rcvData=undefined;
		node.wrappedData=null;	//raw Item 
		node.wrappedPath=null;	//formated Item (change format in case quantity >1)

		node.RW_Error=false;

		if (node.NodeConfig){
			node.status({fill:"red",shape:"dot",text:"disconnected"});	
			
			//Wrap payload and put it into the pollinglist
			if(node.payload!=='' && node.payload!=='"undefined"'){
				node.rcvData=JSON.parse(node.payload);
				node.wrappedData=wrapData(node.rcvData,"data");
				node.wrappedPath=wrapData(node.rcvData,"path");
				pollinglist(node,"add");
			}

			// Intervall init
			if (node.repeat && !isNaN(node.repeat) && node.repeat > 0) {
				node.repeat = node.repeat * 1000;
				if (RED.settings.verbose) { node.log(RED._("inject.repeat",node)); }
				node.interval_id = setInterval( function() {node.emit("input",{});}, node.repeat );
			}
			if (node.once){
				setTimeout( function(){ node.emit("input",{}); }, 100);
			}
			
			node.NodeConfig.register(node,function(){
				if(node.none=="true"){//singleReading!	
					node.on("input", function(){
						if(node.NodeConfig.cnt.read >= 1){
							node.NodeConfig.triggerSingleReading(node,function(ret){
								readingComplete(ret);
							});
						}
					});
				}else if(node.none=="false"){// intervalReading!
					// For a better behavior the intervall is triggered within the register function when quantity of read nodes >1
					node.on("input", function(){
						readingComplete(node);
					});						
				}
			});

			node.on('close', function(done) {
				if(node.NodeConfig){
					if (this.interval_id !== null) {
						clearInterval(this.interval_id);
						if (RED.settings.verbose) { this.log(RED._("inject.stopped")); }
					}					
					pollinglist(node,"remove");
					node.NodeConfig.deregister(node,done);
				}
			});		
		
		}else{
			node.status({fill:"red",shape:"dot",text:"missing configuration"});
        }
		
	}
    RED.nodes.registerType("s7comm read",S7Read);


    function S7Write(n) {
		RED.nodes.createNode(this,n);
		// Node Params passed by Node Red
		this.id=n.id;
		this.type=n.type;
		this.connection =n.connection;
		this.NodeConfig = RED.nodes.getNode(this.connection);
		this.topic=n.topic;
		this.name=n.name;
		this.globallist=n.globallist;
		this.payload=n.payload;
		//local parameter & functions
		var node = this;
		node.rcvData=undefined;
		node.wrappedData=null;	//raw Item 
		node.wrappedPath=null;	//formated Item (change format in case quantity >1)	

		node.RW_Error=false;

		if (node.NodeConfig){
			node.status({fill:"red",shape:"dot",text:"disconnected"});

			//Wrap payload
			if(node.payload!=='' && node.payload!=='"undefined"'){
				node.rcvData=JSON.parse(node.payload);
				node.wrappedData=wrapData(node.rcvData,"data");
				node.wrappedPath=wrapData(node.rcvData,"path");
			}
			
			node.NodeConfig.register(node,function(){
				node.on("input", function(msg) {
					node.NodeConfig.triggerSingleWriting(node,msg);				
				});
			});
			
			node.on('close', function(done) {
				if(node.NodeConfig){
					node.NodeConfig.deregister(node,done);
				}
			});	
        }else{
			node.status({fill:"red",shape:"dot",text:"missing configuration"});
        }	
	}
    RED.nodes.registerType("s7comm write",S7Write);
};