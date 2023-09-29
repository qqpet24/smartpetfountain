#include <WiFi.h>
#include <SPIFFS.h>
#include <ESPAsyncWebServer.h>
#include <HTTPClient.h>
#include <esp_task_wdt.h>
#define FORMAT_SPIFFS_IF_FAILED true
#define RELAY_CONTROL_GPIO 4
#define WATER_SENSOR_GPIO 36

const char *ssid = "Ziyang";
const char *password = NULL;
const char *WIFI_ssid = "Oneplus";
const char *WIFI_password = "leetcode888";

uint8_t buffer[128];
AsyncWebServer server(80);

void setup() {
  for(int i =0;i<sizeof(buffer);i++){
    buffer[i]=0;
  }
  pinMode(RELAY_CONTROL_GPIO, OUTPUT);
  Serial.begin(115200);
  Serial.println();
  WiFi.softAP(ssid, password);
  WiFi.begin(WIFI_ssid,WIFI_password);
  IPAddress myIP = WiFi.softAPIP();
  Serial.println(myIP);
  if(!SPIFFS.begin(FORMAT_SPIFFS_IF_FAILED)){
    Serial.println("SPIFFS Mount Failed");
    return;
  }
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){request->send(SPIFFS, "/index.html");});
  server.on("/on",HTTP_GET,[](AsyncWebServerRequest *request){digitalWrite(RELAY_CONTROL_GPIO, HIGH);request->send(200, "text/plain","OK");});
  server.on("/off",HTTP_GET,[](AsyncWebServerRequest *request){digitalWrite(RELAY_CONTROL_GPIO, LOW);request->send(200, "text/plain","OK");});
  server.on("/sensor", HTTP_GET, [](AsyncWebServerRequest *request){request->send(200, "text/plain",String(read_water_sensor()));});
  server.begin();
}
int read_water_sensor(){
  int val = analogRead(WATER_SENSOR_GPIO);
  return val;
}
int get_file(const char* url){
    HTTPClient http;
    http.setReuse(true);
    http.begin(url);
    int httpResponseCode = http.GET();
    if (httpResponseCode>0) {
      int total = http.getSize();
      Serial.println(String("hs: ")+total);
      if(total<=0) return 1;
      if(total!=0){
        WiFiClient client = http.getStream();
        while(http.connected()&&(total>0||total==-1)){
          while(client.available()){
            int l = client.readBytes(buffer, client.available()>sizeof(buffer)?sizeof(buffer):client.available());
            if(l>0) return 1;
          }
          Serial.println(total);
          delay(100);
        }
        return 0;
      }else{
        return 0;
      }
    }else {
      Serial.print("Error code: ");
      Serial.println(httpResponseCode);
      return 1;
    }
}
void loop(){
  String url1 = String("http://iot.yujiezhu.net/api/water-level?user=1&level=")+String(read_water_sensor());
  String url2 = String("http://iot.yujiezhu.net/api/status?user=1");
  String url3 = String("http://315api.20170904.com/iot/power/on");
  String url4 = String("http://315api.20170904.com/iot/power/off");

  get_file(url1.c_str());
  get_file(url2.c_str());
  Serial.println(buffer[0]);
  if(buffer[0]=='0'){
    digitalWrite(RELAY_CONTROL_GPIO, LOW);
  }else if(buffer[0]=='1'){
    digitalWrite(RELAY_CONTROL_GPIO, HIGH);
  }
  // if(read_water_sensor()<=500){
  //   get_file(url3.c_str());
  // }else{
  //   get_file(url4.c_str());
  // }
  delay(2000);
}
