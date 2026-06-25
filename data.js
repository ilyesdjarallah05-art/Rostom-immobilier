/* Rostom Immobilier - demo property data
   Later, this will come from a real database/API. */

const ROSTOM_DEFAULT_PROPERTIES = [
  {
    id: 'demo-villa-batna', title: 'Modern villa in Batna', category: 'villas', status: 'sale', wilaya: '05 - Batna', commune: 'Batna',
    price: '95000000', currency: 'DZD', surface: '420', rooms: '6', bedrooms: '4', bathrooms: '3', floor: '', landSurface: '600', yearBuilt: '2021',
    phone: '+213 555 000 000', address: 'Batna, Algeria', description: 'Family villa with a large living room, garden, garage and modern finishes.',
    features: ['Garden','Garage','Heating','Equipped kitchen'], images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80'], featured: true, hasVirtualTour: true, virtualTourType: 'pannellum', virtualTourRooms: [{ room: 'Demo 360 room', image: 'https://pannellum.org/images/alma.jpg' }], createdAt: '2026-06-24T10:00:00.000Z'
  },
  {
    id: 'demo-apartment-alger', title: 'High standing apartment', category: 'apartments', status: 'rent', wilaya: '16 - Alger', commune: 'Hydra',
    price: '120000', currency: 'DZD / month', surface: '145', rooms: '4', bedrooms: '3', bathrooms: '2', floor: '5', landSurface: '', yearBuilt: '',
    phone: '+213 555 000 000', address: 'Hydra, Alger', description: 'Bright apartment close to services, ideal for a family or professional tenant.',
    features: ['Elevator','Parking','Security','Balcony'], images: ['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1400&q=80'], featured: true, createdAt: '2026-06-24T11:00:00.000Z'
  },
  {
    id: 'demo-house-setif', title: 'Spacious house with terrace', category: 'houses', status: 'sale', wilaya: '19 - Sétif', commune: 'El Eulma',
    price: '56000000', currency: 'DZD', surface: '260', rooms: '5', bedrooms: '3', bathrooms: '2', floor: 'R+1', landSurface: '310', yearBuilt: '',
    phone: '+213 555 000 000', address: 'El Eulma, Sétif', description: 'Clean, well-located house with terrace and garage space.',
    features: ['Terrace','Garage','Quiet area'], images: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1400&q=80'], featured: true, createdAt: '2026-06-24T12:00:00.000Z'
  },
  {
    id: 'demo-land-oran', title: 'Constructible land', category: 'land', status: 'sale', wilaya: '31 - Oran', commune: 'Bir El Djir',
    price: '38000000', currency: 'DZD', surface: '', rooms: '', bedrooms: '', bathrooms: '', floor: '', landSurface: '520', yearBuilt: '',
    phone: '+213 555 000 000', address: 'Bir El Djir, Oran', description: 'Well-positioned land near the main road. Suitable for a residential project.',
    features: ['Legal papers available','Residential zone','Road access'], images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1400&q=80'], featured: true, createdAt: '2026-06-24T13:00:00.000Z'
  }
];
