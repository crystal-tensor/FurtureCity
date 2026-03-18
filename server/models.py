from pydantic import BaseModel
from typing import List, Optional

class OasisAgentProfile(BaseModel):
    id: str
    name: str
    domain: str
    description: str
    count: int
    satisfaction: float
    stress: float
    energyConsumption: float
    priceSensitivity: float
    comfortPriority: float
    flexibility: float
    socialInfluence: float

class AgentAction(BaseModel):
    step: int
    agentId: str
    type: str  # 'post', 'adjust_load', 'complain'
    content: str
    impact: float

class SocialFeedItem(BaseModel):
    agentId: str
    agentName: str
    content: str
    likes: int
    sentiment: str  # 'positive', 'negative', 'neutral'

class SimulationStep(BaseModel):
    step: int
    timestamp: int
    totalDemand: float
    gridStress: float
    averageSatisfaction: float
    socialSentiment: float
    activeAgents: List[OasisAgentProfile]
    socialFeed: List[SocialFeedItem]

class SimulationRequest(BaseModel):
    populationDrift: float
    weatherVolatility: float
    trafficLoad: float
    industrialLoad: float
    eventLoad: float
    alertThreshold: float

class SimulationResponse(BaseModel):
    steps: List[SimulationStep]
    agents: List[OasisAgentProfile]
