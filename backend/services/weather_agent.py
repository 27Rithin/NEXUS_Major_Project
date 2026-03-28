import random
from typing import Dict, Any

class WeatherVerificationAgent:
    """
    Integrates with public weather APIs (mocked here for local reliability)
    to validate disaster authenticity and add weather severity weight.
    """

    @classmethod
    def get_weather_data(cls, lat: float, lng: float) -> Dict[str, Any]:
        """
        Mock weather API integration.
        Returns temperature, precipitation, wind speed, and a calculated severity (0.0 to 1.0).
        """
        # In a real scenario, make a request to OpenWeatherMap API using the lat/lng
        
        # Simulating heavy rain / storm conditions
        precipitation = random.uniform(0.0, 150.0) # mm
        wind_speed = random.uniform(5.0, 120.0) # km/h
        temperature = random.uniform(-10.0, 45.0) # Celsius

        # Calculate weather severity based on extreme conditions
        weather_score = 0.0
        
        # Heavy rain contributes to severity
        if precipitation > 50.0:
            weather_score += 0.4
        elif precipitation > 20.0:
            weather_score += 0.2
            
        # High winds contribute
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
            "weather_severity": round(weather_severity, 2)
        }
