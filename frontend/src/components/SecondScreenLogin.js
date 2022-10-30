import { Grid, Typography, Stack, Button } from "@mui/material";
import { Item } from './Item';
import { InputCode } from './InputCode'; 

import React, { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

const AUTH_URL = "https://podginatorssso.auth.eu-west-1.amazoncognito.com/login?response_type=token&client_id=35vtfdgo5jolhcpumvof6k9oo8&redirect_uri=https://podginator.com/signedIn"

const buttonStyle = {
    backgroundColor: '#ffd78f',
    color: 'black',
    '&:hover': {
      backgroundColor: '#F8C567',
      color: 'black',
  }
};

export default function SecondScreenInstructions() {
  const [ searchParams ] = useSearchParams();
  const [ inputCode, setInputCode ] = useState([]);
  const inputRefs = useRef([useRef(), useRef(), useRef(), useRef()]);

  const sendLoginCode = (inputCodeParam) => { 
    window.location.href = `${AUTH_URL}&state=${btoa(JSON.stringify({inputCode: inputCodeParam}))}`;
  };

  React.useEffect(() => {
    const inputCodeParam = searchParams.get("code");
    if (inputCodeParam != null) { 
      setInputCode(inputCodeParam)
      sendLoginCode(inputCodeParam);
      return;
    }

    const timeout = setTimeout(() => {
      inputRefs.current[0].current.focus();
    }, 100);

    return () => {
      clearTimeout(timeout);
    };
  }, [searchParams]);


  const addedInputCode = (index) => (evt) => { 
    const inputCodes = [...inputCode]; 

    if (evt.keyCode === 8) { 
      if (inputCodes[index] == null) { 
        setTimeout(() => inputRefs.current[Math.max(index - 1, 0)].current.focus(), 50);
      }

      inputCodes[index] = null;
      setInputCode(inputCodes);
      return;
    }

    if (evt.key.length === 1 && evt.key.match((/[A-Za-z]/))) { 
      inputCodes[index] = evt.key.toUpperCase();
    }
    
    setTimeout(() => inputRefs.current[Math.min(index + 1, 3)].current.focus(), 50);
    setInputCode(inputCodes)
  }

  const renderInputCode = () => { 
    return ( 
      <Stack spacing={2} textAlign={"center"} direction="row" justifyContent="center">
          <Item><InputCode inputRef={inputRefs.current[0]} onKeyDown={addedInputCode(0)} inputProps={{maxLength: 1}} value={inputCode[0]}></InputCode></Item>
          <Item><InputCode inputRef={inputRefs.current[1]} onKeyDown={addedInputCode(1)} inputProps={{maxLength: 1}} value={inputCode[1]}></InputCode></Item>
          <Item><InputCode inputRef={inputRefs.current[2]} onKeyDown={addedInputCode(2)} inputProps={{maxLength: 1}} value={inputCode[2]}></InputCode></Item>
          <Item><InputCode inputRef={inputRefs.current[3]} onKeyDown={addedInputCode(3)} inputProps={{maxLength: 1}} value={inputCode[3]}></InputCode></Item>
      </Stack>
    );
  };

  return (
    <div>
      <Grid container spacing={2}>
        <Grid item md={12}>
          <Typography
            component="h1"
            variant="h3"
            fontWeight={500}
            color="#ffd78f"
            gutterBottom
            textAlign={"center"}
          >
            Enter Code
          </Typography>

        </Grid>
        <Grid item md={12} textAlign={"center"}>
          {renderInputCode()}
        </Grid>
        <Grid item md={12} textAlign={"center"}>
          <Button onClick={(evt) => sendLoginCode(inputCode.join(""))} disabled={inputCode.some(it => it == null)} sx={buttonStyle}>Login</Button>
        </Grid>
      </Grid>
    </div>
  );
}
