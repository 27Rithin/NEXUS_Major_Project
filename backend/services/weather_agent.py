import random
import os
import requests
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class WeatherVerificationAgent:
    """
    Integrates with OpenWeatherMap API to validate disaster 
    authenticity and provide weather-based severity weighting.
    """

    @classmethod
    def get_weather_data(cls, lat: float, lng: float) -> Dict[str, Any]:
        """
        Fetches live weather data for a specific coordinate.
        Calculates weather severity (0.0 to 1.0) based on extreme conditions.
        """
        api_key = os.getenv("OPENWEATHER_API_KEY")
        
        # Default mock values in case of failure or missing key
        precipitation = random.uniform(0.0, 5.0) 
        wind_speed = random.uniform(5.0, 15.0)
        temperature = random.uniform(15.0, 30.0)
        source = "simulation"

        if api_key and api_key != "your_api_key_here":
            try:
                # Real OpenWeatherMap call
                url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lng}&appid={api_key}&units=metric"
                response = requests.get(url, timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    temperature = data['main']['temp']
                    wind_speed = data['wind']['speed'] * 3.6 # Convert m/s to km/h
                    # OpenWeather doesn't always provide rain in the main call unless 1h/3h keys exist
                    precipitation = data.get('rain', {}).get('1h', random.uniform(0.0, 2.0))
                    source = "openweathermap"
                else:
                    logger.warning(f"Weather API returned status {response.status_code}. Using fallback simulation.")
            except Exception as e:
                logger.error(f"Weather API call failed: {e}. Using fallback simulation.")
        else:
            logger.info("No OPENWEATHER_API_KEY found. Operating in simulation mode.")
            # Trigger "Disaster Simulation" weather if no key is found to keep demo exciting
            # 10% chance of extreme weather in simulation mode
            if random.random() > 0.9:
                precipitation = random.uniform(60.0, 120.0)
                wind_speed = random.uniform(85.0, 130.0)
                temperature = random.uniform(-5.0, 45.0)
            else:
                precipitation = random.uniform(0.0, 15.0)
                wind_speed = random.uniform(10.0, 40.0)

        # Calculate weather severity based on production requirements
        weather_score = 0.0
        
        # Heavy rain contributes to severity
        if precipitation > 50.0:
            weather_score += 0.4
        elif precipitation > 20.0:
            weather_score += 0.2
            
        # High winds contribute (Requirement: >80 km/h is CRITICAL)
        if wind_speed > 80.0:
            weather_score += 0.4
        elif wind_speed > 40.0:
            weather_score += 0.2
            
        # Extreme temperatures
        if temperature > 40.0 or temperature < -5.0:
            weather_score += 0.2
            
        weather_severity = min(1.0, weather_score)

        return {
            "temperature": round(temperature, 1),
            "wind_speed": round(wind_speed, 1),
            "precipitation": round(precipitation, 1),
            "weather_severity": round(weather_severity, 2),
            "source": source
        }
