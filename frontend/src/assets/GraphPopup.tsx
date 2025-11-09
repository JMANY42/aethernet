import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export interface GraphPopupProps {
    data: number[];
    maxFill: number;
    name: string;
    width: number;
    height: number
} 

const GraphPopup = ({data = [10, 25, 15, 40, 30, 50, 45, 60, 55, 70], maxFill = 100, name, width=400, height=150}: GraphPopupProps) => {
    console.log("from graph ", data)
    const lineColor = '#570882'; // purple
    const referenceLineColor = '#b80217'; // red
    
    // Calculate min and max for zoom to fit
    const minValue = Math.min(...data);
    const maxValue = Math.max(...data);
    const padding = (maxValue - minValue) * 0.1; // 10% padding
    const yMin = minValue - padding;
    const yMax = maxValue + padding;

    const tickSpace = yMax - yMin;
    
    // Create 6 evenly spaced ticks
    const ticks = [];
    for (let i = 0; i <= 5; i++) {
        ticks.push(Math.round((yMin + tickSpace * (i / 5)) * 10) / 10);
    }
    
    // Transform data array into format Recharts expects
    const chartData = data.map((value, index) => ({
        index,
        value,
        reference: maxFill
    }));
    console.log("name",name);
    return (
        <div className="w-full h-full relative flex flex-col p-4" style={{ height: height+60, width: width }}>
            <h2 className="text-center font-bold text-lg mb-4 text-black">{name}</h2>
            <div style={{ width: '100%', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
                    <XAxis 
                        dataKey="index" 
                        label={{ value: 'Time', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                        label={{ value: 'Potion Level', angle: -90, position: 'insideLeft' }}
                        domain={[yMin, yMax]}
                        ticks={ticks}
                    />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: '#F5F5DC', 
                            color: '#3E2C1C',
                            border: '1px solid #C19A6B',
                            borderRadius: '4px'
                        }}
                        labelStyle={{ color: '#3E2C1C' }}
                        labelFormatter={() => ''}

                        formatter={(value: any, name: string) => {
                            if (name === 'Value') {
                                const percentage = ((value / maxFill) * 100).toFixed(1);
                                return [`${percentage}% of max`];
                            }
                            return null;
                        }}                    
                    />

                    {yMax > maxFill &&  ( <Line 
                        type="monotone" 
                        dataKey="reference" 
                        stroke={referenceLineColor}
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        dot={false}
                        // name={`Fill Percentage: `}
                    /> )}

                    <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={lineColor}
                        strokeWidth={2}
                        dot={{ fill: lineColor, r: 3 }}
                        activeDot={{ r: 5 }}
                        name={`Value`}

                    />
                </LineChart>
            </ResponsiveContainer>
            </div>
        </div>
    )
}

export default GraphPopup