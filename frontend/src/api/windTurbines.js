// windTurbines.js
import axios from 'axios'

export const uploadWindTurbines = (formData) => {
  return axios.post('/api/wind-turbines/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }).then(res => res.data)
}