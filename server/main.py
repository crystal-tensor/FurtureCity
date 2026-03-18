from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .models import SimulationRequest, SimulationResponse
from .simulation import OasisSimulation

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "OASIS Server Running", "version": "0.1.0"}

@app.post("/simulate", response_model=SimulationResponse)
def simulate(request: SimulationRequest):
    sim = OasisSimulation(request)
    steps = sim.run()
    return SimulationResponse(steps=steps, agents=sim.agents)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
