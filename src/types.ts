export type Filter = {
  boundingBox: (number | undefined)[][],
}

export type Data = {
  vehicles: VehicleUpdate
}

export type VehicleUpdate = {
  vehicleId: string
  location: {
    latitude: number,
    longitude: number
  }
}
