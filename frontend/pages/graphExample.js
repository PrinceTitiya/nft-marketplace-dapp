import { useQuery } from "@tanstack/react-query"
import { gql, request } from "graphql-request"

const query = gql`
    {
        activeItems(first: 5) {
            id
            seller
            nftAddress
            tokenId
            price
        }
    }
`
const url = "https://api.studio.thegraph.com/query/102524/nft-marketplace/version/latest"

export default function GraphExample() {
    const { data, status } = useQuery({
        queryKey: ["activeItems"],
        queryFn: async () => {
            return await request(url, query)
        },
    })

    if (status === "pending") return <div>Loading...</div>
    if (status === "error") return <div>Error fetching data</div>

    console.log(data)

    return (
        <div>
            <h1>Active Items</h1>
            {data?.activeItems.map((item) => (
                <div key={item.id}>
                    <p>Token ID: {item.tokenId}</p>
                    <p>Seller: {item.seller}</p>
                    <p>NFT-Address: {item.nftAddress}</p>
                    <p>Price: {item.price}</p>
                    <hr />
                </div>
            ))}
        </div>
    )
}