import random
import math
from typing import List, Dict
from .models import OasisAgentProfile, AgentAction, SimulationStep, SimulationRequest, SocialFeedItem
from .agent_templates import AGENT_TEMPLATES

# Try to import camel agents if available, otherwise mock behavior logic
try:
    from camel.agents import ChatAgent
    CAMEL_AVAILABLE = True
except ImportError:
    CAMEL_AVAILABLE = False

class OasisSimulation:
    def __init__(self, config: SimulationRequest):
        self.config = config
        self.agents = [agent.model_copy() for agent in AGENT_TEMPLATES]
        self.current_step = 0
        self.grid_stability = 1.0
        
        # Apply config modifiers
        for agent in self.agents:
            if agent.domain == 'Residential':
                agent.count = int(agent.count * (1 + config.populationDrift / 100))
            if agent.domain == 'Industrial':
                agent.energyConsumption *= (1 + config.industrialLoad / 100)

    def _get_weather_impact(self, hour: int, weather_volatility: float) -> float:
        # Base temperature curve (hottest at 14:00)
        base_temp = 25 + 10 * math.sin((hour - 8) * math.pi / 12)
        # Random fluctuation based on volatility
        noise = random.gauss(0, weather_volatility / 10)
        return base_temp + noise

    def _generate_social_post(self, agent: OasisAgentProfile, context: Dict) -> str:
        # Simple template-based generation for speed, could be replaced by LLM
        templates = []
        
        if context['grid_stability'] < 0.8:
            if agent.domain == 'Residential':
                templates = [
                    "家里灯光在闪烁，是不是电压不稳？",
                    "这种天气还要限电吗？太难受了。",
                    "听说隔壁小区已经停电了，瑟瑟发抖。",
                ]
            elif agent.domain == 'Industrial':
                templates = [
                    "电压波动导致生产线报警，损失谁来承担？",
                    "紧急启动备用电源，成本飙升。",
                ]
            elif agent.domain == 'Civic':
                templates = [
                    "医院启用双路供电保障，请市民放心。",
                    "地铁运行正常，但空调已调低。",
                ]
        elif context['price'] > 1.5:
            if agent.domain == 'Residential':
                templates = [
                    "电费怎么这么贵！不敢开空调了。",
                    "这电价是在抢钱吗？",
                ]
            elif agent.domain == 'Commercial':
                templates = [
                    "商场空调调高两度，响应节能号召（其实是为了省钱）。",
                    "成本压力太大，考虑缩短营业时间。",
                ]
        else:
            if agent.domain == 'Grid':
                templates = [
                    "电网运行平稳，新能源消纳率创新高。",
                    "今日负荷预计在下午3点达到峰值。",
                ]
            elif agent.domain == 'Residential':
                templates = [
                    "天气不错，晒晒被子。",
                    "今天家里用电一切正常。",
                ]
        
        return random.choice(templates) if templates else "运行正常。"

    def run(self) -> List[SimulationStep]:
        steps = []
        
        for hour in range(24):
            # Environment factors
            weather_impact = self._get_weather_impact(hour, self.config.weatherVolatility)
            # Price logic (simplified: high demand -> high price)
            base_price = 0.5
            
            # Calculate Demand & Supply
            total_demand = 0
            total_supply = 0
            
            # 1. Calculate Grid State
            for agent in self.agents:
                # Calculate consumption/generation for this hour
                # Profile curve: simple sine wave peaking at different times
                hour_factor = 1.0
                if agent.domain == 'Residential':
                    # Peak at 20:00
                    hour_factor = 0.5 + 0.5 * math.sin((hour - 14) * math.pi / 12) + 0.5
                elif agent.domain == 'Solar':
                    # Peak at 12:00, 0 at night
                    hour_factor = max(0, math.sin((hour - 6) * math.pi / 12)) * 1.5
                
                # Apply weather impact (cooling load)
                weather_load = 1.0
                if weather_impact > 30 and agent.domain in ['Residential', 'Commercial']:
                    weather_load = 1.0 + (weather_impact - 30) * 0.1 * agent.comfortPriority

                current_load = agent.energyConsumption * agent.count * hour_factor * weather_load
                
                if current_load > 0:
                    total_demand += current_load
                else:
                    total_supply -= current_load # Convert negative consumption to supply

            # Determine Grid State
            margin = total_supply - total_demand
            if margin < 0:
                self.grid_stability = max(0.5, self.grid_stability - 0.1)
                price = base_price * 2.0
            elif margin < total_demand * 0.1: # Low reserve
                self.grid_stability = max(0.8, self.grid_stability - 0.05)
                price = base_price * 1.5
            else:
                self.grid_stability = min(1.0, self.grid_stability + 0.05)
                price = base_price

            # 2. Agent Reactions (Social Posts & Active Agents)
            active_agents_list = []
            social_feed = []
            
            # Sample a few agents to post
            # Higher stress = more posts
            num_posts = 3
            if self.grid_stability < 0.8:
                num_posts = 5
            
            sampled_agents = random.sample(self.agents, k=min(num_posts, len(self.agents)))
            
            total_satisfaction = 0
            sentiment_score = 0
            
            for agent in sampled_agents:
                context = {
                    'grid_stability': self.grid_stability,
                    'price': price,
                    'weather': weather_impact
                }
                
                # Update agent internal state (Mock)
                if self.grid_stability < 0.9:
                    agent.stress = min(100, agent.stress + 5)
                    agent.satisfaction = max(0, agent.satisfaction - 5)
                else:
                    agent.stress = max(0, agent.stress - 2)
                    agent.satisfaction = min(100, agent.satisfaction + 2)
                
                # Generate post
                content = self._generate_social_post(agent, context)
                sentiment = 'neutral'
                if '贵' in content or '停电' in content or '难受' in content:
                    sentiment = 'negative'
                    sentiment_score -= 10
                elif '正常' in content or '不错' in content:
                    sentiment = 'positive'
                    sentiment_score += 5
                
                feed_item = SocialFeedItem(
                    agentId=agent.id,
                    agentName=agent.name,
                    content=content,
                    likes=random.randint(0, 100),
                    sentiment=sentiment
                )
                social_feed.append(feed_item)
                active_agents_list.append(agent)

            # Calculate average satisfaction
            avg_satisfaction = sum(a.satisfaction for a in self.agents) / len(self.agents)

            steps.append(SimulationStep(
                step=hour,
                timestamp=hour * 3600 * 1000, # Mock timestamp
                totalDemand=total_demand,
                gridStress=(1.0 - self.grid_stability) * 100,
                averageSatisfaction=avg_satisfaction,
                socialSentiment=max(-100, min(100, sentiment_score)),
                activeAgents=active_agents_list,
                socialFeed=social_feed
            ))
            
        return steps
