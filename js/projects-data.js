/* ==========================================================================
   projects-data.js — the content for every project case study
   --------------------------------------------------------------------------
   One entry per project. The case-study template (js/case-study.js) renders
   whatever is filled in and silently skips anything left as null.

   To see what is still missing, open the site with  ?draft  in the URL
   (e.g. https://yoursite/?draft). Empty fields then show as dashed
   "TO ADD" boxes. Visitors never see them.

   Fields
     id          short slug, also used in links: yoursite/#project-<id>
     tier        'flagship' (full case study) or 'early' (short write-up)
     title, subtitle, category
     facts       context / date / role / status        (null = hidden)
     links       [{ label, url }]  e.g. GitHub, report  (empty = hidden)
     stack       { groupName: [items] }
     media       [{ type: 'image' | 'video' | 'youtube', src, caption, alt? }]
     problem, approach (array of paragraphs / bullet lists), outcome
     iterations  [{ label, text }]                      (null = hidden)
     challenge   the hardest problem and how it was solved
     next        what you would do next
     credits     small print (image credits etc.)
     extra       id of a built-in interactive block ('doppler')

   HELD BACK on purpose until David supplies them:
     metrics     key numbers  [{ value, label }]
     diagram     real block diagram  { src, caption }
   ========================================================================== */
window.PROJECTS = [
    {
        id: 'meteor',
        tier: 'flagship',
        title: 'METEOR-M2 Ground Station',
        subtitle: 'Pulling digital weather imagery out of a polar-orbiting satellite with a low-cost radio',
        category: 'RF & Satellite DSP',
        facts: { context: 'Data Communication Systems course', date: null, role: null, status: null },
        links: [],
        stack: {
            'Hardware': ['RTL-SDR'],
            'Software': ['Gpredict', 'TLE orbital data'],
            'Signal chain': ['137 MHz VHF', 'LRPT', 'QPSK demodulation', 'Viterbi FEC']
        },
        media: [
            { type: 'image', src: 'assets/projects/meteor-m2/Met_Sat.webp', caption: 'Decoded multispectral composite from a live pass' },
            { type: 'image', src: 'assets/projects/meteor-m2/Met_Setup_PreRecording.webp', caption: 'SDR receiver and pre-recording pipeline' },
            { type: 'image', src: 'assets/projects/meteor-m2/Met_ExampleFrequency.webp', caption: 'RF spectrum with the 137 MHz carrier' },
            { type: 'image', src: 'assets/projects/meteor-m2/Met_NoiseCapture_Harmonics.webp', caption: 'Waterfall showing harmonics and the noise floor' }
        ],
        problem: 'Meteor-M2 broadcasts digital imagery as it passes overhead at low-Earth-orbit speeds. Receiving it means predicting each pass, correcting for a carrier frequency that drifts with the satellite’s motion, and decoding a digital signal, all with an inexpensive USB radio.',
        approach: [
            'Built a software-defined radio receiving station and a signal-processing chain from antenna to image:',
            ['Gpredict with Two-Line Element (TLE) data to compute passes, trajectories and real-time Doppler corrections.',
             'An RTL-SDR pipeline on the 137 MHz VHF band capturing Low-Rate Picture Transmission (LRPT) signals encoded with QPSK.',
             'Digital demodulation, Viterbi error correction and packet parsing to assemble multispectral scanlines into composite images.',
             'A comparison of Meteor’s digital LRPT against legacy analog NOAA APT transmissions.']
        ],
        outcome: 'Decoded multispectral composite imagery from a live satellite pass.',
        iterations: null,
        challenge: null,
        next: null,
        credits: null,
        extra: 'doppler'
    },
    {
        id: 'lerobot',
        tier: 'flagship',
        title: 'AI Robotic Arm with LeRobot',
        subtitle: 'Teaching a low-cost arm to manipulate objects by demonstration',
        category: 'Edge AI & Robotics',
        facts: { context: 'AI in Robotics course', date: null, role: null, status: null },
        links: [{ label: 'Demo on YouTube', url: 'https://youtu.be/Q0pi9PrmghY' }],
        stack: {
            'Hardware': ['Edge compute unit', 'Feetech smart servos', 'L298N motor drivers'],
            'AI': ['Hugging Face LeRobot', 'PyTorch', 'CUDA', 'Imitation learning'],
            'Control': ['PID']
        },
        media: [
            { type: 'youtube', src: 'https://www.youtube.com/embed/Q0pi9PrmghY', caption: 'Demo video' },
            { type: 'image', src: 'assets/projects/lerobot-arm/LR_ArmsClosed.webp', caption: 'Assembled arm on the lab bench' },
            { type: 'image', src: 'assets/projects/lerobot-arm/LR_ArmDisA.webp', caption: 'Disassembly: actuator mounts and structure' }
        ],
        problem: 'Hand-coding every motion path for a robot arm is slow and brittle. The goal was an arm that learns manipulation tasks from demonstrations, mapping what it sees and where its joints are directly to joint actions.',
        approach: [
            'Built the arm around an edge computing unit and trained imitation-learning policies with Hugging Face’s LeRobot framework:',
            ['LeRobot with CUDA-accelerated PyTorch to train and run real-time policies.',
             'Feetech smart servos and L298N motor drivers for multi-axis movement.',
             'Closed-loop PID control to manage motor response, reduce overshoot and keep joint motion smooth.',
             'Sensor telemetry used to keep policy inference in step with the physical joint dynamics.']
        ],
        outcome: 'A trained policy running on the physical arm, shown in the demo video.',
        iterations: null,
        challenge: null,
        next: null,
        credits: null
    },
    {
        id: 'fpga',
        tier: 'flagship',
        title: 'FPGA Reaction Timer',
        subtitle: 'Racing start-lights and a millisecond timer, described entirely in Verilog',
        category: 'Digital Logic',
        facts: { context: 'Microprocessor Architecture course', date: null, role: null, status: null },
        links: [],
        stack: {
            'Hardware': ['Intel FPGA board', '7-segment displays'],
            'Design': ['Verilog HDL', 'Finite-state machine', 'LFSR', 'Binary-to-BCD'],
            'Tools': ['Quartus Prime']
        },
        media: [
            { type: 'image', src: 'assets/projects/fpga-reaction-timer/RT_BFront.webp', caption: 'The timer running on the FPGA board' },
            { type: 'image', src: 'assets/projects/fpga-reaction-timer/RT_Assignments.webp', caption: 'Pin assignments' },
            { type: 'image', src: 'assets/projects/fpga-reaction-timer/RT_ExampleF1.webp', caption: 'Start-light reference' },
            { type: 'image', src: 'assets/projects/fpga-reaction-timer/RT_NetV.webp', caption: 'RTL netlist view' }
        ],
        problem: 'Measure human reaction time to the millisecond with no processor and no software: just digital logic recreating the start lights used in racing.',
        approach: [
            'The whole design is hardware described in Verilog:',
            ['A Linear Feedback Shift Register (LFSR) generates the random wait before the lights go out.',
             'The board’s 50 MHz clock is divided down to drive a millisecond counter.',
             'A Binary-to-BCD converter drives the 7-segment displays.',
             'A state machine sequences IDLE → COUNTDOWN → TIMING.']
        ],
        outcome: 'A working start-light timer on real hardware. A browser version is playable in the Playground on this page.',
        iterations: null,
        challenge: null,
        next: null,
        credits: 'Start-light reference image: <a href="https://pixelcom.io/motorsport/circuits/starting-lights" target="_blank" rel="noopener noreferrer">PixelCom</a>.',
        cta: { label: 'Play it in the Playground', href: '#playground' }
    },
    {
        id: 'balance',
        tier: 'flagship',
        title: 'Self-Balancing Robot',
        subtitle: 'Keeping an inverted pendulum upright with a PID loop on an ARM Cortex-M4',
        category: 'Embedded & Control',
        facts: { context: 'Embedded Systems course', date: null, role: null, status: null },
        links: [],
        stack: {
            'Hardware': ['TI TIVA LaunchPad (ARM Cortex-M4)', 'IMU', 'DC motors'],
            'Firmware': ['Embedded C', 'PID control', 'I²C', 'PWM']
        },
        media: [
            { type: 'image', src: 'assets/projects/self-balancing-robot/SBR_V1.webp', caption: 'Version 1' },
            { type: 'image', src: 'assets/projects/self-balancing-robot/SBR_V2.webp', caption: 'Version 2' },
            { type: 'image', src: 'assets/projects/self-balancing-robot/SBR_V3.webp', caption: 'Version 3' },
            { type: 'image', src: 'assets/projects/self-balancing-robot/SBR_V4.webp', caption: 'Version 4' },
            { type: 'image', src: 'assets/projects/self-balancing-robot/SBR_V4Neck.webp', caption: 'Version 4 with the extended neck mount' },
            { type: 'video', src: 'assets/projects/self-balancing-robot/SBR_Vid1.mp4', caption: 'Demo video 1' },
            { type: 'video', src: 'assets/projects/self-balancing-robot/SBR_Vid2.mp4', caption: 'Demo video 2' },
            { type: 'video', src: 'assets/projects/self-balancing-robot/SBR_Vid3.mp4', caption: 'Demo video 3' }
        ],
        problem: 'A two-wheeled robot is an inverted pendulum: left alone it falls over. Staying upright takes continuous sensing and correction, fast enough to catch the tilt before it becomes a fall.',
        approach: [
            'Converted a three-wheel chassis into a two-wheel balancing vehicle controlled by a Texas Instruments TIVA LaunchPad:',
            ['An IMU read over I²C reports the robot’s orientation.',
             'A PID loop computes the motor torque needed to hold the target angle.',
             'PWM signals drive the DC motors to correct tilt in real time.']
        ],
        outcome: 'Four hardware iterations, documented in photos and demo videos.',
        iterations: null,
        challenge: null,
        next: null,
        credits: null
    },
    {
        id: 'aircraft',
        tier: 'flagship',
        title: 'Aircraft Tracker',
        subtitle: 'Identifying aircraft overhead from their own 1090 MHz broadcasts',
        category: 'Communications',
        facts: { context: 'Circuit Communications course', date: null, role: null, status: null },
        links: [],
        stack: {
            'Hardware': ['RTL-SDR (USB)', 'Antenna'],
            'Signal': ['ADS-B', '1090 MHz', 'IQ sample processing']
        },
        media: [
            { type: 'image', src: 'assets/projects/aircraft-tracker/AT_WorldFR.webp', caption: 'World map of live flights (FlightRadar24)' },
            { type: 'image', src: 'assets/projects/aircraft-tracker/AT_IniSetUp.webp', caption: 'RTL-SDR dongle and antenna setup' },
            { type: 'video', src: 'assets/projects/aircraft-tracker/AT_Vid.mp4', caption: 'Demo video' }
        ],
        problem: 'Aircraft continuously broadcast who and where they are. The goal was to capture those broadcasts with inexpensive hardware and turn raw radio samples into identifiable flights.',
        approach: [
            'A USB RTL-SDR and antenna capture Automatic Dependent Surveillance–Broadcast (ADS-B) signals at 1090 MHz. Processing the raw IQ samples extracts frames containing each aircraft’s ICAO address, callsign, altitude and velocity. The focus was hardware configuration and signal-processing theory.'
        ],
        outcome: 'Live identification of aircraft overhead from raw radio samples.',
        iterations: null,
        challenge: null,
        next: null,
        credits: 'World map image courtesy of <a href="https://www.flightradar24.com/blog/inside-flightradar24/pull-down-menu/" target="_blank" rel="noopener noreferrer">FlightRadar24</a>.'
    },
    {
        id: 'water',
        tier: 'flagship',
        title: 'Water Monitoring System',
        subtitle: 'Turbidity and temperature telemetry from sensor to cloud dashboard',
        category: 'IoT',
        facts: { context: 'Sensor Applications course', date: null, role: null, status: null },
        links: [],
        stack: {
            'Hardware': ['Arduino', 'Turbidity sensor', 'Temperature sensor'],
            'Software': ['NI LabVIEW', 'ThingSpeak API'],
            'Interfaces': ['ADC', 'UART', 'HTTP POST']
        },
        media: [
            { type: 'image', src: 'assets/projects/water-monitoring/WM_LVF.webp', caption: 'LabVIEW front panel dashboard' },
            { type: 'image', src: 'assets/projects/water-monitoring/WM_Circ.webp', caption: 'Sensor circuit' },
            { type: 'image', src: 'assets/projects/water-monitoring/WM_Disp.webp', caption: 'Local readout display' },
            { type: 'image', src: 'assets/projects/water-monitoring/WM_DispV2.webp', caption: 'Second version of the readout display' },
            { type: 'image', src: 'assets/projects/water-monitoring/WM_LVnA.webp', caption: 'LabVIEW block diagram' },
            { type: 'image', src: 'assets/projects/water-monitoring/WM_WebDisp.webp', caption: 'Cloud dashboard of logged readings' }
        ],
        problem: 'Checking water quality by hand is slow and only gives a snapshot. The goal was continuous readings that could be watched locally and remotely.',
        approach: [
            'Analog sensors measure turbidity and temperature:',
            ['An Arduino performs the ADC conversion and streams raw readings over UART to a host PC.',
             'A custom LabVIEW application parses the data and shows it on a local dashboard.',
             'The same application sends HTTP POST requests to the ThingSpeak API for cloud logging.']
        ],
        outcome: 'Live readings on a local dashboard and in the cloud.',
        iterations: null,
        challenge: null,
        next: null,
        credits: null
    },
    {
        id: 'parking',
        tier: 'early',
        title: 'Smart Parking System',
        subtitle: 'Interrupt-driven occupancy tracking with IR sensors',
        category: 'Automation',
        facts: { context: 'Digital Systems course', date: null, role: null, status: null },
        links: [],
        stack: {
            'Hardware': ['Arduino', 'IR obstruction sensors', '16×2 I²C LCD'],
            'Firmware': ['Interrupts', 'I²C']
        },
        media: [
            { type: 'image', src: 'assets/projects/smart-parking/SP_Top.webp', caption: 'Top view of the parking-lot model' },
            { type: 'image', src: 'assets/projects/smart-parking/SP_BottomV1.webp', caption: 'Underside wiring' },
            { type: 'image', src: 'assets/projects/smart-parking/SP_Circ.webp', caption: 'Circuit schematic' },
            { type: 'video', src: 'assets/projects/smart-parking/SP_Vid.mp4', caption: 'Demo video' }
        ],
        problem: 'Drivers waste time entering lots that are already full.',
        approach: [
            'IR obstruction sensors sit at each bay and at the entrance and exit. The Arduino runs an interrupt-based counter to track occupancy and updates a 16×2 I²C LCD with the number of free slots.'
        ],
        outcome: 'A live free-space count shown at the entrance.',
        iterations: null, challenge: null, next: null, credits: null
    },
    {
        id: 'line',
        tier: 'early',
        title: 'Line-Following Robot',
        subtitle: 'Differential steering with IR reflectance sensing',
        category: 'Robotics',
        facts: { context: 'Circuits 2 course', date: null, role: null, status: null },
        links: [],
        stack: {
            'Hardware': ['Arduino', 'L298N motor driver', 'IR comparators'],
            'Control': ['Bang-bang', 'Differential steering']
        },
        media: [
            { type: 'image', src: 'assets/projects/line-follower/LF_CompleteA.webp', caption: 'Completed robot, top view' },
            { type: 'image', src: 'assets/projects/line-follower/LF_CompleteAF.webp', caption: 'Completed robot, front view' },
            { type: 'image', src: 'assets/projects/line-follower/LF_PV1.webp', caption: 'Prototype version 1' },
            { type: 'image', src: 'assets/projects/line-follower/LF_PV2.webp', caption: 'Prototype version 2' },
            { type: 'video', src: 'assets/projects/line-follower/LF_Vid.mp4', caption: 'Following the track' },
            { type: 'video', src: 'assets/projects/line-follower/LF_Func.mp4', caption: 'Function test' },
            { type: 'video', src: 'assets/projects/line-follower/LF_FuncDS.mp4', caption: 'Function test, second take' },
            { type: 'video', src: 'assets/projects/line-follower/LF_HeightLim.mp4', caption: 'Sensor height limit test' },
            { type: 'video', src: 'assets/projects/line-follower/LF_SensorFunc.mp4', caption: 'Sensor function test' }
        ],
        problem: 'Follow a track autonomously using as little sensing as possible.',
        approach: [
            'Two IR proximity sensors (comparators) detect a black line on a white surface. A bang-bang controller adjusts differential steering through an L298N driver: if the left sensor sees black, the robot steers left to re-centre.'
        ],
        outcome: 'A robot that tracks a black line on its own.',
        iterations: null, challenge: null, next: null, credits: null
    },
    {
        id: 'vgg',
        tier: 'flagship',
        title: 'Tiny-VGG Classifier',
        subtitle: 'A compact convolutional network for image classification in PyTorch',
        category: 'Machine Learning',
        facts: { context: null, date: null, role: null, status: null },
        links: [],
        stack: {
            'Language': ['Python'],
            'Framework': ['PyTorch'],
            'Model': ['Conv2d', 'ReLU', 'MaxPool', 'Classifier head']
        },
        media: [
            { type: 'image', src: 'assets/projects/tiny-vgg/TVGG_Results.webp', caption: 'Sample predictions' },
            { type: 'image', src: 'assets/projects/tiny-vgg/TVGG_Chart.webp', caption: 'Training loss and accuracy' },
            { type: 'image', src: 'assets/projects/tiny-vgg/VGG_Arch.webp', caption: 'VGG architecture reference' }
        ],
        problem: 'Full-size VGG networks are slow to train and iterate on. The goal was a scaled-down version that keeps the architecture’s structure while training quickly.',
        approach: [
            'Recreated the VGG (Visual Geometry Group) architecture at "Tiny" scale in PyTorch:',
            ['Sequential convolutional blocks (Conv2d, ReLU, MaxPool) feeding a classifier head.',
             'A custom dataset loader.',
             'Training-loop visualisation of loss and accuracy, plus evaluation scripts.']
        ],
        outcome: 'A trained model with loss and accuracy tracking and evaluation scripts.',
        iterations: null,
        challenge: null,
        next: null,
        credits: null
    },
    {
        id: 'laser',
        tier: 'early',
        title: 'Laser Security System',
        subtitle: 'My first university build: a purely analog tripwire',
        category: 'Analog',
        facts: { context: 'Circuits 1 course', date: null, role: null, status: null },
        links: [],
        stack: {
            'Components': ['Laser', 'LDR', 'BJT', '5 V buzzer']
        },
        media: [
            { type: 'image', src: 'assets/projects/laser-security/SL_House.webp', caption: 'Tripwire mounted in a model house' },
            { type: 'video', src: 'assets/projects/laser-security/SL_Assembly.mp4', caption: 'Assembly' },
            { type: 'video', src: 'assets/projects/laser-security/SL_FA.mp4', caption: 'Final assembly test' },
            { type: 'video', src: 'assets/projects/laser-security/SL_Inside.mp4', caption: 'Inside the enclosure' }
        ],
        problem: 'Detect a broken beam using only analog parts, with no microcontroller.',
        approach: [
            'A Light Dependent Resistor (LDR) sits in a voltage divider feeding the base of a BJT. When the laser beam is broken, the LDR’s resistance rises, the base voltage rises, and the transistor switches on to drive a 5 V buzzer.'
        ],
        outcome: 'A working analog tripwire.',
        iterations: null, challenge: null, next: null, credits: null
    }
];
