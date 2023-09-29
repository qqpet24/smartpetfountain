const fs = require('fs');
const net = require('net');
class FileDatabase{
    constructor(path) {
        this.path = path;
    }
    async read(){
        try{
            const file = await fs.promises.readFile(this.path, 'utf8');
            return JSON.parse(file);
        }catch (e){
            return [];
        }
    }
    async store(data){
        try{
            await fs.promises.unlink(this.path);
            return fs.promises.writeFile(this.path, JSON.stringify(data));
        }catch (e){
            return fs.promises.writeFile(this.path, JSON.stringify(data));
        }
    }
}
class API{
    constructor(historyPath) {
        this.waterLevel = 0;
        this.powerStatus = 0;//0->close 1->on
        this.history = [];
        this.isInitialize = false;
        this.historyDataBase = new FileDatabase(historyPath);
    }
    async initialize(){
        if(this.isInitialize===false){
            this.isInitialize = true;
            this.history = await this.historyDataBase.read();
        }
    }
    async dispatch(type,path,param,body){
        await this.initialize();
        if(type=="GET"){
            if(path.includes("/iot/water-level")) return this.setWaterLevel(type,null,param,body);
            else if(path.includes("/frontend/water-level/current")) return this.getCurrentWaterLevel(type,null,param,body);
            else if(path.includes("/iot/power/status")) return this.getPowerStatus(type,null,param,body);
            else if(path.includes("/iot/power/on")) return this.turnOnPower(type,null,param,body);
            else if(path.includes("/iot/power/off")) return this.turnOffPower(type,null,param,body);
            else if(path.includes("/frontend/water-level/history")) return this.getHistory(type,null,param,body);
            else return this.notFound();
        }else{
            return this.notFound();
        }
    }
    getCurrentWaterLevel(type,pathValue,param,body){
        var response = new HttpResponse(200,"OK","application/json",JSON.stringify({level:this.waterLevel}));
        return response;
    }
    async setWaterLevel(type,pathValue,param,body){
        this.waterLevel = parseInt(param.get("level"));
        var timestamp = Math.floor(new Date().getTime() / 1000);
        this.history.push({'time':timestamp,'level':this.waterLevel});
        await this.historyDataBase.store(this.history);
        var response = new HttpResponse(200,"OK","text/plain","");
        return response;
    }
    getPowerStatus(type,pathValue,param,body){
        var response = new HttpResponse(200,"OK","text/plain",""+this.powerStatus);
        return response;
    }
    turnOnPower(type,pathValue,param,body){
        this.powerStatus = 1;
        var response = new HttpResponse(200,"OK","text/plain","");
        return response;
    }
    turnOffPower(type,pathValue,param,body){
        this.powerStatus = 0;
        var response = new HttpResponse(200,"OK","text/plain","");
        return response;
    }
    getHistory(type,pathValue,param,body){
        var response = new HttpResponse(200,"OK","application/json",JSON.stringify(this.history));
        return response;
    }
    notFound(){
        var response = new HttpResponse(404,"Not Found","text/plain","Path not found");
        return response;
    }
}
class HttpResponse{
    constructor(code,message,contentType,body) {
        this.code = code;
        this.message = message;
        this.contentType = contentType;
        this.body = body;
    }
    getString(){
        //return 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nDate: Thu, 09 Mar 2023 05:19:40 GMT\r\nConnection: keep-alive\r\nKeep-Alive: timeout=5\r\n\r\n 2323234';
        var contentLength = 0;
        if(this.body!=null){
            contentLength = this.body.length;
        }
        return `HTTP/1.1 ${this.code} ${this.message}\r\nContent-Type: ${this.contentType}\r\nDate: Thu, 09 Mar 2023 05:19:40 GMT\r\nConnection: keep-alive\r\nKeep-Alive: timeout=5\r\nContent-Length: ${contentLength}\r\n\r\n${this.body}`;
    }
}

var socketServer = net.createServer().listen(8088,function (){
    console.log("Socket server listening");
})
var api = new API('./water-level.txt');
socketServer.on('connection', function (socket){
    socket.on('data', async function (data) {
        // ignore request body and header
        try{
            socket.setKeepAlive(enable = true, 5);
            var rawRequest = data.toString();
            var rawRequestArray = rawRequest.split("\r\n");
            var type = rawRequestArray[0].split(" ")[0];
            var path = rawRequestArray[0].split(" ")[1];
            var param = null;
            if (path.split("?").length > 1) {
                var tmp = (path.split("?")[1]).split("&");
                param = new Map();
                for (var i = 0; i < tmp.length; i++) {
                    param.set(tmp[i].split("=")[0], tmp[i].split("=")[1]);
                }

            }
            path = path.split("?")[0];
            var response = await api.dispatch(type, path, param, null);
            socket.write(response.getString());
            socket.destroy();
        }catch (e){
            console.log(e);
            var response = new HttpResponse(500,"Internal Server Error","text/plain",e);
            socket.write(response.getString());
            socket.destroy();
        }
    }).on('end', function() {
        console.log('SOCKET ENDED');
    }).on('error',(e)=>console.log(e));
});
socketServer.on('error',(e)=>{console.log(e)});
