
import { Stadium } from '../types';

export const STADIUMS: Record<string, Stadium> = {
  // Mexico
  azteca: { id: 'azteca', name: 'Estádio Azteca', city: 'Cidade do México', country: 'MEX', capacity: 83000 },
  akron: { id: 'akron', name: 'Estádio Akron', city: 'Guadalajara', country: 'MEX', capacity: 48000 },
  bbva: { id: 'bbva', name: 'Estádio BBVA', city: 'Monterrey', country: 'MEX', capacity: 53500 },

  // Canada
  bmo: { id: 'bmo', name: 'BMO Field', city: 'Toronto', country: 'CAN', capacity: 45000 },
  bcplace: { id: 'bcplace', name: 'BC Place', city: 'Vancouver', country: 'CAN', capacity: 54000 },

  // USA
  metlife: { id: 'metlife', name: 'MetLife Stadium', city: 'New York/New Jersey', country: 'USA', capacity: 82500 },
  att: { id: 'att', name: 'AT&T Stadium', city: 'Dallas', country: 'USA', capacity: 94000 },
  arrowhead: { id: 'arrowhead', name: 'Arrowhead Stadium', city: 'Kansas City', country: 'USA', capacity: 73000 },
  nrg: { id: 'nrg', name: 'NRG Stadium', city: 'Houston', country: 'USA', capacity: 72000 },
  mercedes: { id: 'mercedes', name: 'Mercedes-Benz Stadium', city: 'Atlanta', country: 'USA', capacity: 75000 },
  sofi: { id: 'sofi', name: 'SoFi Stadium', city: 'Los Angeles', country: 'USA', capacity: 70000 },
  lincoln: { id: 'lincoln', name: 'Lincoln Financial Field', city: 'Philadelphia', country: 'USA', capacity: 69000 },
  lumen: { id: 'lumen', name: 'Lumen Field', city: 'Seattle', country: 'USA', capacity: 69000 },
  levis: { id: 'levis', name: "Levi's Stadium", city: 'San Francisco Bay Area', country: 'USA', capacity: 71000 },
  gillette: { id: 'gillette', name: 'Gillette Stadium', city: 'Boston', country: 'USA', capacity: 65000 },
  hardrock: { id: 'hardrock', name: 'Hard Rock Stadium', city: 'Miami', country: 'USA', capacity: 65000 },
};
