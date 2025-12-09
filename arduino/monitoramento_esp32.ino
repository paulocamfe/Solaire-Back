#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "SALA";      
const char* password = "123456789";
const char* serverUrl = "http://192.168.43.74:3333/esp32/data"; 

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n=== Iniciando ESP32 ===");
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  Serial.print("Conectando WiFi: ");
  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 20) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi conectado!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ Falha ao conectar WiFi!");
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    // Leia os sensores (exemplo com seus valores reais)
    int panelId = 1;
    float temperatura = 25.5;   // DHT22, etc
    float corrente = 8.065;      // Sensor de corrente
    float tensao = 0.32;         // Sensor de tensão
    float potencia = tensao * corrente;

    // Crie JSON com ArduinoJson
    StaticJsonDocument<256> doc;
    doc["panelId"] = panelId;
    doc["temperatura"] = temperatura;
    doc["corrente"] = corrente;
    doc["tensao"] = tensao;
    doc["potencia"] = potencia;

    String json;
    serializeJson(doc, json);

    Serial.println("\n📤 Enviando dados:");
    Serial.println(json);

    // Envie para o servidor
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    int httpCode = http.POST(json);
    
    Serial.print("Resposta do servidor: ");
    Serial.println(httpCode);
    
    if (httpCode == 200) {
      String response = http.getString();
      Serial.println("✅ Resposta: " + response);
    } else {
      Serial.print("❌ Erro: ");
      Serial.println(http.errorToString(httpCode).c_str());
    }
    
    http.end();

    delay(5000); // a cada 5 segundos
  } else {
    Serial.println("❌ WiFi desconectado - tentando reconectar...");
    WiFi.reconnect();
    delay(2000);
  }
}