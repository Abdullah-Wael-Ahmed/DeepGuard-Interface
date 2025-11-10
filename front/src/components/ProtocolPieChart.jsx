import { Cell, PieChart, Legend, Pie, ResponsiveContainer, Tooltip } from "recharts"

const ProtocolPieChart = () => {

    const data = [
        { name: "UDP", value: 400 },
        { name: "TCP", value: 143 },
        { name: "ICMP", value: 3 },
        { name: "Other", value: 0 }
    ]
    const COLORS = ["#FACC15", "#3B82F6", "#10B981", "#737373"];

    return (
        <div className="w-full h-80 bg-card-dark p-4 rounded-2xl shadow-lg">
            <h2 className='text-xl font-semibol text-text-main mb-4'>Orders Status</h2>

            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={data}
                        dataKey={"value"}
                        nameKey={"name"}
                        
                        cx="50%"
                        cy="55%"
                        outerRadius={100}
                        innerRadius={60}
                        
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index]} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "#EAEAEA",
                            borderRadius: "8px",
                            border: "none",
                            color: "#000000",
                        }}
                    />
                    <Legend
                        verticalAlign="bottom"
                        align="center"
                        wrapperStyle={{
                            position: "relative",
                            marginTop: "20px",
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>

        </div>
    );
}

export default ProtocolPieChart;
