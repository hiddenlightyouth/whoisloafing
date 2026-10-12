import { useIpPlace } from '../lib/geo'

/** IP 주소와 그 주소의 대략적인 위치를 "주소 (위치)"로 보여줘요. 위치를 알아내지 못하면 주소만 보여줘요. */
export function IpPlace({ ip }: { ip: string }) {
  const place = useIpPlace(ip)
  return (
    <>
      {ip}
      {place && ` (${place})`}
    </>
  )
}
